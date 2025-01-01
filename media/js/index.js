if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../../media/js/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

window.addEventListener('online', () => {
  console.log('Internet connection restored. Attempting to sync transactions...');
  syncTransactions();
});

window.addEventListener('offline', () => {
  console.warn('Internet connection lost. Transactions will be saved locally.');
});

// Script to check local storage and fetch types from the backend when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  const expenseKey = 'expenseTypes';
  const incomeKey = 'incomeTypes';

  try {
    const cachedExpenseTypes = getLocalStorageData(expenseKey);
    const cachedIncomeTypes = getLocalStorageData(incomeKey);

    if (cachedExpenseTypes && cachedIncomeTypes) {
      console.log('Expense and Income types are already in local storage.');
      initializeCategoryDropdown();
      addEventListenersForForm();
      return;
    }

    console.log('Fetching types from backend...');
    const transactionEnumsData = await fetchTransactionTypes();

    if (transactionEnumsData.success) {
      storeLocalStorageData(expenseKey, transactionEnumsData.data.expenseTypes);
      storeLocalStorageData(incomeKey, transactionEnumsData.data.incomeTypes);
      console.log('Types fetched and stored in local storage successfully.');
      initializeCategoryDropdown();
      addEventListenersForForm();
    }
  } catch (error) {
    console.error('Error fetching transaction types:', error.message);
    // Optionally show an error message to the user
  }
});

// Utility function to fetch transaction types
async function fetchTransactionTypes() {
  const response = await fetch('https://spendwise-backend-ggixkn6mu-rider4585s-projects.vercel.appapi/getTransactionTypes');
  if (!response.ok) {
    throw new Error(`Failed to fetch transaction types: ${response.statusText}`);
  }
  return await response.json();
}

// Utility function to get data from local storage
function getLocalStorageData(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error parsing local storage data for key "${key}":`, error.message);
    return null;
  }
}

// Utility function to store data in local storage
function storeLocalStorageData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error storing data in local storage for key "${key}":`, error.message);
  }
}

// Function to initialize dynamic category selection
function initializeCategoryDropdown() {
  const typeDropdown = document.getElementById('type');
  const categoryDropdown = document.getElementById('category');

  // Define categories for each type
  const categories = {
    income: getLocalStorageData('incomeTypes'),
    expense: getLocalStorageData('expenseTypes'),
  };

  typeDropdown.addEventListener('change', function () {
    const selectedType = this.value;

    // Clear previous options
    categoryDropdown.innerHTML = '<option value="">Select Category</option>';

    // Populate options based on the selected type
    if (categories[selectedType]) {
      categories[selectedType].forEach((category) => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        categoryDropdown.appendChild(option);
      });
    }
  });

  console.log('Category dropdown initialized.');
}

function addEventListenersForForm() {
  const form = document.getElementById('transactionForm');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const note = document.getElementById('note').value;

    const transactionData = {
      type,
      category,
      amount,
      date: new Date().toISOString(),
      note,
    };

    const success = await addTransaction(transactionData);
    if (success) {
      alert('Transaction added successfully!');
      form.reset();
    } else {
      alert('Transaction saved locally and will sync when online.');
      form.reset();
    }
  });

}

async function addTransaction(data) {
  if (navigator.onLine) {
    try {
      const response = await fetch('https://spendwise-backend-ggixkn6mu-rider4585s-projects.vercel.appapi/addTransaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to save transaction: ${response.statusText}`);
      }

      console.log('Transaction saved to Firestore:', data);
      return true;
    } catch (error) {
      console.error('Error saving transaction to Firestore:', error.message);
      return false;
    }
  } else {
    console.warn('No internet connection. Saving transaction locally.');
    saveTransactionLocally(data);
    return false;
  }
}

function saveTransactionLocally(transaction) {
  const unsyncedTransactions = JSON.parse(localStorage.getItem('unsyncedTransactions')) || [];
  unsyncedTransactions.push(transaction);
  localStorage.setItem('unsyncedTransactions', JSON.stringify(unsyncedTransactions));
}

// Helper function to validate transaction data
function validateTransactionData(data) {
  const requiredFields = ['type', 'category', 'amount', 'date'];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }
  if (typeof data.amount !== 'number' || data.amount <= 0) {
    console.error('Invalid amount. It should be a positive number.');
    return false;
  }
  if (!['expense', 'income'].includes(data.type)) {
    console.error('Invalid type. It should be either "expense" or "income".');
    return false;
  }
  if (isNaN(new Date(data.date).getTime())) {
    console.error('Invalid date format. Please provide a valid ISO date string.');
    return false;
  }
  return true;
}

async function syncTransactions() {
  const unsyncedTransactions = JSON.parse(localStorage.getItem('unsyncedTransactions')) || [];
  if (unsyncedTransactions.length === 0) {
    console.log('No transactions to sync.');
    return;
  }

  console.log('Syncing transactions:', unsyncedTransactions);

  for (const transaction of unsyncedTransactions) {
    try {
      const success = await addTransaction(transaction);
      if (!success) {
        console.error('Failed to sync transaction:', transaction);
        return; // Stop syncing on failure to avoid overwriting unsynced data
      }
    } catch (error) {
      console.error('Error syncing transaction:', error.message);
      return;
    }
  }

  // Clear local storage after successful sync
  localStorage.removeItem('unsyncedTransactions');
  console.log('All transactions synced successfully.');
}