// ============================================
// State Management
// ============================================
let state = {
    user: '',
    email: '',
    theme: 'light',
    currency: 'LKR',
    budgetLimit: 0, // Stored in LKR base
    savingsGoal: 0, // Stored in LKR base
    transactions: [], // Amounts stored in LKR base
    transactionType: 'expense', // default form state
    chartTimeFilter: 7,
    daysLeft: 1,
    lastUpdatedDate: null,
    editingId: null,
    savingsMode: 'income', // 'income' or 'budget'
    currentWindow: 0 // Index of the 3-day window for pagination
};

const currencySymbols = {
    'LKR': 'Rs ',
    'USD': '$',
    'INR': '₹',
    'EUR': '€'
};

let exchangeRatesToLKR = {
    'LKR': 1,
    'USD': 300,
    'INR': 3.6,
    'EUR': 320
};

async function updateExchangeRates() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/LKR');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        if (data.result === 'success' && data.rates) {
            // API returns rates relative to 1 LKR (e.g. 1 LKR = 0.003 USD)
            // Our logic needs: 1 unit of target currency = X units of LKR (e.g. 1 USD = 333 LKR)
            const supportedCurrencies = ['USD', 'INR', 'EUR'];
            supportedCurrencies.forEach(curr => {
                if (data.rates[curr]) {
                    exchangeRatesToLKR[curr] = 1 / data.rates[curr];
                }
            });
            console.log('Exchange rates updated successfully:', exchangeRatesToLKR);
            updateUI(); // Refresh UI with new rates
        }
    } catch (error) {
        console.error('Failed to fetch real-time exchange rates, using fallback:', error);
    }
}

// Convert from base LKR to target currency
function convertFromBase(amountInLKR, targetCurrency) {
    return amountInLKR / exchangeRatesToLKR[targetCurrency];
}

// Convert from input currency to base LKR
function convertToBase(amountInCurrency, sourceCurrency) {
    return amountInCurrency * exchangeRatesToLKR[sourceCurrency];
}

function formatCurrency(amountInLKR) {
    const convertedAmount = convertFromBase(amountInLKR, state.currency);
    return `${currencySymbols[state.currency] || ''}${convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Chart instances
let pieChartInstance = null;
let barChartInstance = null;

// ============================================
// DOM Elements
// ============================================
const DOMElements = {
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    
    // Auth & Account
    authTabBtns: document.querySelectorAll('.auth-tab-btn'),
    loginSection: document.getElementById('login-section'),
    registerSection: document.getElementById('register-section'),
    registerForm: document.getElementById('register-form'),
    loginIdentifierInput: document.getElementById('login-identifier'),
    loginPasswordInput: document.getElementById('login-password'),
    registerEmailInput: document.getElementById('register-email'),
    registerUsernameInput: document.getElementById('register-username'),
    registerPasswordInput: document.getElementById('register-password'),
    
    accountOverlay: document.getElementById('account-overlay'),
    accountIconBtn: document.getElementById('account-icon-btn'),
    closeAccountBtn: document.getElementById('close-account-btn'),
    accountForm: document.getElementById('account-form'),
    accountUsernameInput: document.getElementById('account-username'),
    accountEmailInput: document.getElementById('account-email'),
    accountPasswordInput: document.getElementById('account-password'),

    appContainer: document.getElementById('app-container'),
    greetingText: document.getElementById('greeting-text'),
    themeToggle: document.getElementById('theme-toggle'),
    currencySelector: document.getElementById('currency-selector'),

    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    balanceWarning: document.getElementById('balance-warning'),

    budgetLimitInput: document.getElementById('budget-limit'),
    savingsGoalInput: document.getElementById('savings-goal'),
    daysLeftInput: document.getElementById('days-left'),
    savingsProgressText: document.getElementById('savings-progress-text'),
    savingsProgressBar: document.getElementById('savings-progress-bar'),
    savingsProgressContainer: document.getElementById('savings-progress-container'),

    dailyAllowanceValue: document.getElementById('daily-allowance-value'),
    dailyWarningSign: document.getElementById('daily-warning-sign'),
    dailyRemainingValue: document.getElementById('daily-remaining-value'),

    addTransactionForm: document.getElementById('add-transaction-form'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    transactionDesc: document.getElementById('transaction-desc'),
    transactionAmount: document.getElementById('transaction-amount'),
    transactionTime: document.getElementById('transaction-time'),
    transactionCategory: document.getElementById('transaction-category'),
    categoryGroup: document.getElementById('category-group'), // hide for income
    budgetToggleGroup: document.getElementById('budget-toggle-group'),
    formInBudgetToggle: document.getElementById('form-in-budget'),

    submitBtn: document.getElementById('submit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    formHeader: document.getElementById('form-header'),

    transactionList: document.getElementById('transaction-list'),
    emojiContainer: document.getElementById('emoji-container'),
    emptyState: document.getElementById('empty-state'),

    exportCsvBtn: document.getElementById('export-csv'),
    exportPdfBtn: document.getElementById('export-pdf'),
    resetDataBtn: document.getElementById('reset-data'),
    toastContainer: document.getElementById('toast-container'),

    paginationControls: document.getElementById('pagination-controls'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),

    expensePieChartCtx: document.getElementById('expensePieChart').getContext('2d'),
    weeklyBarChartCtx: document.getElementById('weeklyBarChart').getContext('2d'),

    filterBtns: document.querySelectorAll('.filter-btn'),
    savingsModeBtns: document.querySelectorAll('.mode-btn')
};

// ============================================
// Initialization & LocalStorage
// ============================================
function init() {
    setupEventListeners();
    applyTheme();
    setDefaultTime();
    updateExchangeRates(); // Fetch fresh rates asynchronously

    // Check for "Remember Me" / Auto-login
    const lastUser = localStorage.getItem('financeTracker_currentUser');
    if (lastUser) {
        loadUserData(lastUser).then(() => {
            showApp();
            updateCharts(); // Refresh charts once visible to ensure correct dimensions and colors
            showToast(`Welcome back!`, 'success');
        }).catch(() => {
            DOMElements.loginOverlay.classList.add('active');
        });
    } else {
        DOMElements.loginOverlay.classList.add('active');
    }
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function handleDaysLeftLogic() {
    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Default calculation: days remaining in current month
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const defaultDaysLeft = lastDayOfMonth - now.getDate() + 1;

    if (!state.lastUpdatedDate) {
        // Initial setup or reset
        state.daysLeft = defaultDaysLeft;
        state.lastUpdatedDate = todayStr;
    } else {
        // Calculate difference in days between today and last update
        const lastUpdate = new Date(state.lastUpdatedDate);
        // Set both to midnight for accurate day comparison
        const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
        
        const diffTime = d1.getTime() - d2.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            state.daysLeft = Math.max(0, state.daysLeft - diffDays);
            state.lastUpdatedDate = todayStr;
        } else if (diffDays < 0) {
            // Clock was moved back? Just reset lastUpdatedDate to today
            state.lastUpdatedDate = todayStr;
        }
    }

    if (DOMElements.daysLeftInput) {
        DOMElements.daysLeftInput.value = state.daysLeft;
    }
    saveState();
}

function setDefaultTime() {
    const now = new Date();
    // Offset for local timezone to get ISO string correctly for datetime-local
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
    if (DOMElements.transactionTime) {
        DOMElements.transactionTime.value = localISOTime;
    }
}

function getWindowIdx(ts) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(Math.max(0, diff) / 3);
}

function loadState() {
    const savedState = localStorage.getItem('financeTrackerState');
    if (savedState) {
        state = { ...state, ...JSON.parse(savedState) };
        if (!state.transactions) state.transactions = [];
        if (!state.chartTimeFilter) state.chartTimeFilter = 7;

        // Handle migration from INR base data smoothly (assume old data was INR if not specified previously, though we mapped existing logic directly. Let's just run with it.)
    }
}

function saveState() {
    if (!state.user) return;
    
    localStorage.setItem('financeTracker_currentUser', state.user);
    localStorage.setItem('financeTrackerState_' + state.user, JSON.stringify(state));

    const syncEl = document.getElementById('sync-status');
    if (syncEl) {
        syncEl.className = 'sync-status syncing';
    }

    // Sync with Neon DB via Netlify Functions
    fetch('/.netlify/functions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user, state: state })
    })
    .then(response => {
        if (!response.ok) throw new Error('Sync failed');
        if (syncEl) {
            syncEl.className = 'sync-status connected';
            syncEl.title = 'Cloud Sync: Active (Neon DB)';
        }
    })
    .catch(error => {
        console.warn("Cloud sync failed:", error);
        if (syncEl) {
            syncEl.className = 'sync-status error';
            syncEl.title = 'Cloud Sync: Offline/Error';
        }
    });
}

async function loadUserData(userId) {
    state.user = userId;

    const syncEl = document.getElementById('sync-status');
    if (syncEl) syncEl.className = 'sync-status syncing';

    try {
        // Try fetching from Neon DB via Netlify Function
        const response = await fetch(`/.netlify/functions/sync?userId=${encodeURIComponent(userId)}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data) {
                state = { ...state, ...data, user: userId };
            }
        } else if (response.status === 404) {
            console.log("New user, no remote data found.");
        } else {
            throw new Error('Database response not ok');
        }
    } catch (error) {
        console.warn("Sync unavailable, using local storage:", error);
        // Fallback to local storage
        const saved = localStorage.getItem('financeTrackerState_' + userId);
        if (saved) {
            state = { ...state, ...JSON.parse(saved), user: userId };
        }
    }

    // Refresh UI
    handleDaysLeftLogic();
    applyTheme();
    updateUI();

    // Save as current user for auto-login
    localStorage.setItem('financeTracker_currentUser', userId);
}

// ============================================
// UI Updates
// ============================================
function updateUI() {
    DOMElements.greetingText.textContent = `Hello, ${state.user}!`;

    // Display inputs in current currency by converting from base
    DOMElements.budgetLimitInput.value = state.budgetLimit ? convertFromBase(state.budgetLimit, state.currency).toFixed(0) : '';
    DOMElements.savingsGoalInput.value = state.savingsGoal ? convertFromBase(state.savingsGoal, state.currency).toFixed(0) : '';
    DOMElements.currencySelector.value = state.currency || 'LKR';

    // Update savings mode toggle UI
    if (DOMElements.savingsModeBtns) {
        DOMElements.savingsModeBtns.forEach(btn => {
            if (btn.dataset.mode === state.savingsMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Toggle savings progress visibility
    if (DOMElements.savingsProgressContainer) {
        if (state.savingsMode === 'budget') {
            DOMElements.savingsProgressContainer.classList.add('hidden');
        } else {
            DOMElements.savingsProgressContainer.classList.remove('hidden');
        }
    }

    // Calculate totals (Internal LKR)
    const incomeLKR = state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const budgetedIncomeLKR = state.transactions
        .filter(t => t.type === 'income' && t.inBudget)
        .reduce((sum, t) => sum + t.amount, 0);

    const expenseLKR = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    function calculateRemainingBudget() {
        const effectiveBudget = state.budgetLimit + budgetedIncomeLKR;
        return effectiveBudget - expenseLKR;
    }

    const totalRemainingBudgetLKR = calculateRemainingBudget();
    const spendableRemainingBudgetLKR = state.savingsMode === 'budget' ? totalRemainingBudgetLKR - state.savingsGoal : totalRemainingBudgetLKR;
    const effectiveBudgetLKR = state.budgetLimit + budgetedIncomeLKR;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaysExpensesLKR = state.transactions
        .filter(t => t.type === 'expense' && t.timestamp >= todayStart.getTime())
        .reduce((sum, t) => sum + t.amount, 0);

    DOMElements.totalIncome.textContent = formatCurrency(incomeLKR);
    DOMElements.totalExpense.textContent = formatCurrency(todaysExpensesLKR);

    // Total Balance is now Remaining Budget (Spendable)
    const balanceEl = DOMElements.totalBalance;
    if (spendableRemainingBudgetLKR < 0 && state.budgetLimit > 0) {
        balanceEl.classList.add('text-danger', 'over-budget');
        balanceEl.innerHTML = `${formatCurrency(spendableRemainingBudgetLKR)} <span class="over-budget-badge">Over Budget</span>`;
    } else {
        balanceEl.classList.remove('text-danger', 'over-budget');
        balanceEl.textContent = formatCurrency(spendableRemainingBudgetLKR);
    }

    // Warnings and savings progress
    // Warning logic should consider the reduced budget
    handleBudgetWarning(expenseLKR, state.savingsMode === 'budget' ? effectiveBudgetLKR - state.savingsGoal : effectiveBudgetLKR);
    handleDailyBudget(spendableRemainingBudgetLKR);

    // Savings Progress Calculation
    let progressSourceLKR = 0;
    if (state.savingsMode === 'budget') {
        // From Budget: Total Remaining Budget (before reduction for display)
        progressSourceLKR = totalRemainingBudgetLKR;
    } else {
        // From Income: Total Income - Total Expenses
        progressSourceLKR = incomeLKR - expenseLKR;
    }

    handleSavingsProgress(progressSourceLKR);

    renderTransactions();
    updateCharts();
}

function handleDailyBudget(remainingBudgetLKR) {
    const dailyAllowanceLKR = state.daysLeft > 0 ? Math.max(0, remainingBudgetLKR / state.daysLeft) : 0;
    DOMElements.dailyAllowanceValue.textContent = formatCurrency(dailyAllowanceLKR);

    // Calculate today's expenses (Internal LKR)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaysExpensesLKR = state.transactions
        .filter(t => t.type === 'expense' && t.timestamp >= todayStart.getTime())
        .reduce((sum, t) => sum + t.amount, 0);

    const dailyRemainingLKR = dailyAllowanceLKR - todaysExpensesLKR;
    if (DOMElements.dailyRemainingValue) {
        DOMElements.dailyRemainingValue.textContent = formatCurrency(dailyRemainingLKR);
        if (dailyRemainingLKR < 0) {
            DOMElements.dailyRemainingValue.classList.remove('text-success');
            DOMElements.dailyRemainingValue.classList.add('text-danger');
        } else {
            DOMElements.dailyRemainingValue.classList.remove('text-danger');
            DOMElements.dailyRemainingValue.classList.add('text-success');
        }
    }

    // Trigger alert if today's expenses exceed daily allowance OR total budget is negative
    if (todaysExpensesLKR > dailyAllowanceLKR && dailyAllowanceLKR > 0) {
        document.body.classList.add('budget-exceeded');
        DOMElements.dailyWarningSign.style.display = 'inline-block';
        
        // Calculate overspend intensity (very low base 0.05 + scaling)
        const overspentAmount = todaysExpensesLKR - dailyAllowanceLKR;
        const baseIntensity = 0.05;
        const scalingFactor = Math.min(overspentAmount / 5000, 1);
        const intensity = baseIntensity + (scalingFactor * (1 - baseIntensity));
        document.body.style.setProperty('--overspend-intensity', intensity);
    } else {
        document.body.classList.remove('budget-exceeded');
        DOMElements.dailyWarningSign.style.display = 'none';
        document.body.style.setProperty('--overspend-intensity', 0);
    }
}

function renderTransactions() {
    const list = DOMElements.transactionList;
    list.innerHTML = '';

    if (state.transactions.length === 0) {
        DOMElements.emptyState.style.display = 'block';
        DOMElements.paginationControls.classList.add('hidden');
        return;
    }

    DOMElements.emptyState.style.display = 'none';

    // Filter by current window
    const filtered = state.transactions.filter(t => getWindowIdx(t.timestamp) === state.currentWindow);
    
    // Sort filtered transactions (latest first)
    const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

    // Update Pagination UI
    const maxWindow = state.transactions.reduce((max, t) => Math.max(max, getWindowIdx(t.timestamp)), 0);
    
    DOMElements.paginationControls.classList.remove('hidden');
    DOMElements.pageInfo.textContent = `Days ${state.currentWindow * 3} - ${state.currentWindow * 3 + 2} ago`;
    DOMElements.prevPageBtn.disabled = state.currentWindow === 0;
    DOMElements.nextPageBtn.disabled = state.currentWindow >= maxWindow;

    if (sorted.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions in this period.</td></tr>`;
    } else {
        sorted.forEach(t => {
            const row = document.createElement('tr');
            const dateObj = new Date(t.timestamp);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            row.innerHTML = `
                <td data-label="Actions">
                    <div class="action-btns">
                        ${t.type === 'income' ? `
                            <button class="btn-budget ${t.inBudget ? 'active' : ''}" onclick="toggleIncomeBudget('${t.id}')" title="${t.inBudget ? 'Remove from Budget' : 'Add to Budget'}">
                                <i class="fa-solid fa-vault"></i>
                            </button>
                        ` : ''}
                        <button class="btn-edit" onclick="startEdit('${t.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-delete" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
                <td data-label="Date">
                    <div class="date-text">${dateStr}</div>
                    <div class="time-text subtitle">${timeStr}</div>
                </td>
                <td data-label="Description">${t.desc}</td>
                <td data-label="Category">${t.type === 'expense' ? t.category : '-'}</td>
                <td data-label="Amount" class="${t.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                </td>
                <td data-label="Type">${t.type === 'income' ? '<i class="fa-solid fa-arrow-down text-success"></i>' : '<i class="fa-solid fa-arrow-up text-danger"></i>'}</td>
            `;
            list.appendChild(row);
        });
    }
}

window.toggleIncomeBudget = function (id) {
    const transaction = state.transactions.find(t => t.id === id);
    if (transaction && transaction.type === 'income') {
        transaction.inBudget = !transaction.inBudget;
        saveState();
        updateUI();
        showToast(transaction.inBudget ? 'Income added to budget' : 'Income removed from budget', 'success');
    }
};

// Make delete available globally
window.deleteTransaction = function (id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveState();
        updateUI();
        showToast('Transaction deleted', 'success');
    }
};

window.startEdit = function (id) {
    const transaction = state.transactions.find(t => t.id === id);
    if (!transaction) return;

    state.editingId = id;
    state.transactionType = transaction.type;

    // Populate form
    DOMElements.transactionDesc.value = transaction.desc;
    DOMElements.transactionAmount.value = convertFromBase(transaction.amount, state.currency).toFixed(0);

    // Set timestamp correctly for datetime-local
    const date = new Date(transaction.timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    DOMElements.transactionTime.value = localISOTime;

    // Update Tabs
    DOMElements.tabBtns.forEach(btn => {
        if (btn.dataset.type === transaction.type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (transaction.type === 'income') {
        DOMElements.categoryGroup.classList.add('hidden');
        DOMElements.transactionDesc.placeholder = "e.g. Salary, Part-time job";
    } else {
        DOMElements.categoryGroup.classList.remove('hidden');
        DOMElements.transactionCategory.value = transaction.category;
        DOMElements.transactionDesc.placeholder = "e.g. Lunch at canteen";
    }

    // Update UI
    DOMElements.formHeader.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Transaction`;
    DOMElements.submitBtn.textContent = 'Update Transaction';
    DOMElements.cancelEditBtn.classList.remove('hidden');

    // Scroll to form
    DOMElements.addTransactionForm.scrollIntoView({ behavior: 'smooth' });
};

window.cancelEdit = function () {
    state.editingId = null;
    DOMElements.addTransactionForm.reset();
    setDefaultTime();

    // Reset UI
    DOMElements.formHeader.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Add Transaction`;
    DOMElements.submitBtn.textContent = 'Add Transaction';
    DOMElements.cancelEditBtn.classList.add('hidden');

    // Reset tabs to default (expense)
    state.transactionType = 'expense';
    DOMElements.tabBtns.forEach(btn => {
        if (btn.dataset.type === 'expense') btn.classList.add('active');
        else btn.classList.remove('active');
    });
    DOMElements.categoryGroup.classList.remove('hidden');
    DOMElements.transactionDesc.placeholder = "e.g. Lunch at canteen";
};

function handleBudgetWarning(expenseLKR, effectiveBudgetLKR) {
    if (effectiveBudgetLKR > 0) {
        const percent = (expenseLKR / effectiveBudgetLKR) * 100;
        if (percent >= 90 && percent < 100) {
            DOMElements.balanceWarning.innerHTML = `<span class="text-warning"><i class="fa-solid fa-triangle-exclamation"></i> Warning: Nearing monthly budget!</span>`;
        } else if (percent >= 100) {
            DOMElements.balanceWarning.innerHTML = `<span class="text-danger"><i class="fa-solid fa-circle-xmark"></i> Budget Limit Exceeded!</span>`;
        } else {
            DOMElements.balanceWarning.textContent = `${(100 - percent).toFixed(1)}% of budget remaining`;
        }
    } else {
        DOMElements.balanceWarning.textContent = 'Set a budget goal';
    }
}

function handleSavingsProgress(balanceLKR) {
    if (state.savingsGoal > 0) {
        let progress = 0;
        if (balanceLKR > 0) {
            progress = (balanceLKR / state.savingsGoal) * 100;
        }
        if (progress > 100) progress = 100;

        DOMElements.savingsProgressText.textContent = `${progress.toFixed(1)}%`;
        DOMElements.savingsProgressBar.style.width = `${progress}%`;
    } else {
        DOMElements.savingsProgressText.textContent = '0%';
        DOMElements.savingsProgressBar.style.width = '0%';
    }
}

// ============================================
// Charts Logic (Chart.js)
// ============================================
function filterTransactionsByDays(days) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return state.transactions.filter(t => t.timestamp >= cutoff);
}

function updateCharts() {
    const daysCount = state.chartTimeFilter;
    const filteredExpenses = filterTransactionsByDays(daysCount).filter(t => t.type === 'expense');

    // 1. Pie Chart for Categories
    const categories = ['Breakfast', 'Lunch', 'Dinner', 'Transport', 'Rent', 'Entertainment', 'Books', 'Other'];
    const categoryTotals = categories.map(cat => {
        // sum in base LKR
        const totalLKR = filteredExpenses.filter(e => {
            // If it's a food-related category, divide by time
            if (e.category === 'Food' || e.category === 'Breakfast' || e.category === 'Lunch' || e.category === 'Dinner') {
                const hour = new Date(e.timestamp).getHours();
                if (cat === 'Breakfast') return hour >= 4 && hour < 11;
                if (cat === 'Lunch') return hour >= 11 && hour < 17;
                if (cat === 'Dinner') return hour >= 17 || hour < 4;
                return false;
            }
            // Otherwise match normally
            return e.category === cat;
        }).reduce((sum, e) => sum + e.amount, 0);
        return convertFromBase(totalLKR, state.currency); // chart visual in target currency
    });

    const pieColors = ['#fbbf24', '#f87171', '#be123c', '#34d399', '#60a5fa', '#a78bfa', '#2dd4bf', '#94a3b8'];

    if (pieChartInstance) pieChartInstance.destroy();

    pieChartInstance = new Chart(DOMElements.expensePieChartCtx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: categoryTotals,
                backgroundColor: pieColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-primary'), padding: 20 } },
                title: { display: true, text: `Expenses by Category (${daysCount} Days)`, color: getComputedStyle(document.body).getPropertyValue('--text-primary'), padding: { bottom: 20 } }
            }
        }
    });

    // 2. Bar Chart for daily expenses
    const labels = [];
    const recentDailyTotals = Array(daysCount).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate labels and structure
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (daysCount <= 7) {
            labels.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]);
        } else {
            labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        }
    }

    filteredExpenses.forEach(e => {
        const d = new Date(e.timestamp);
        d.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - d.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < daysCount) {
            recentDailyTotals[daysCount - 1 - diffDays] += convertFromBase(e.amount, state.currency);
        }
    });

    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(DOMElements.weeklyBarChartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Daily Expenses (${currencySymbols[state.currency] || ''})`,
                data: recentDailyTotals,
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--primary-color'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(150,150,150,0.1)' }, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary') } },
                x: { grid: { display: false }, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary') } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: `Spending Over Time (${daysCount} Days)`, color: getComputedStyle(document.body).getPropertyValue('--text-primary') }
            }
        }
    });
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Auth Tabs Switching
    DOMElements.authTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOMElements.authTabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            if (e.target.dataset.tab === 'login') {
                DOMElements.loginSection.classList.remove('hidden');
                DOMElements.registerSection.classList.add('hidden');
            } else {
                DOMElements.loginSection.classList.add('hidden');
                DOMElements.registerSection.classList.remove('hidden');
            }
        });
    });

    // Login Form Submit
    DOMElements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = DOMElements.loginIdentifierInput.value.trim();
        const password = DOMElements.loginPasswordInput.value.trim();
        
        if (identifier) {
            const loginBtn = document.getElementById('login-btn');
            const originalText = loginBtn.textContent;
            
            loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
            loginBtn.disabled = true;

            try {
                // Check auth
                const res = await fetch('/.netlify/functions/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'login',
                        payload: { identifier, password }
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                await loadUserData(data.username);
                if (data.email) state.email = data.email;
                saveState();
                
                DOMElements.loginOverlay.classList.remove('active');
                showApp();
                updateCharts();
                showToast(`Welcome back, ${data.username}!`, 'success');
            } catch (error) {
                // Check if it's connection error or real auth error
                if (error.message === 'Failed to fetch') {
                     showToast("Connection error. Using local data if available.", "warning");
                     await loadUserData(identifier);
                     DOMElements.loginOverlay.classList.remove('active');
                     showApp();
                } else {
                     showToast(error.message, "danger");
                }
            } finally {
                loginBtn.textContent = originalText;
                loginBtn.disabled = false;
            }
        }
    });

    // Register Form Submit
    DOMElements.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = DOMElements.registerEmailInput.value.trim();
        const username = DOMElements.registerUsernameInput.value.trim();
        const password = DOMElements.registerPasswordInput.value.trim();

        // Reset error state
        DOMElements.registerUsernameInput.classList.remove('input-error');

        if (email && username && password) {
            const registerBtn = document.getElementById('register-btn');
            const originalText = registerBtn.textContent;
            
            registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
            registerBtn.disabled = true;

            try {
                const res = await fetch('/.netlify/functions/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'register',
                        payload: { username, email, password }
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Registration failed');

                await loadUserData(username);
                state.email = data.email || email;
                saveState();
                
                DOMElements.loginOverlay.classList.remove('active');
                showApp();
                updateCharts();
                showToast(`Registration successful! Welcome, ${username}.`, 'success');
            } catch (error) {
                showToast(error.message, "danger");
                if (error.message.includes('username is already taken')) {
                    DOMElements.registerUsernameInput.classList.add('input-error');
                    DOMElements.registerUsernameInput.focus();
                }
            } finally {
                registerBtn.textContent = originalText;
                registerBtn.disabled = false;
            }
        }
    });

    // Account Overlay Triggers
    DOMElements.accountIconBtn.addEventListener('click', () => {
        DOMElements.accountUsernameInput.value = state.user;
        DOMElements.accountEmailInput.value = state.email || '';
        DOMElements.accountPasswordInput.value = '';
        DOMElements.accountOverlay.classList.add('active');
    });

    DOMElements.closeAccountBtn.addEventListener('click', () => {
        DOMElements.accountOverlay.classList.remove('active');
    });

    // Account Form Submit
    DOMElements.accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = DOMElements.accountEmailInput.value.trim();
        const password = DOMElements.accountPasswordInput.value.trim();
        const updateBtn = document.getElementById('update-account-btn');
        const originalText = updateBtn.textContent;
        
        updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        updateBtn.disabled = true;

        try {
            const res = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    payload: { username: state.user, email, password: password || undefined }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');

            if (email) state.email = email;
            saveState();

            showToast('Account updated successfully!', 'success');
            DOMElements.accountOverlay.classList.remove('active');
        } catch (error) {
            showToast(error.message, "danger");
        } finally {
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
        }
    });

    DOMElements.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme();
        saveState();
        updateCharts();
    });

    DOMElements.currencySelector.addEventListener('change', (e) => {
        state.currency = e.target.value;
        saveState();
        updateUI();
    });

    // Chart Time Filters
    DOMElements.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOMElements.filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.chartTimeFilter = parseInt(e.target.dataset.days);
            saveState();
            updateCharts();
        });
    });

    DOMElements.budgetLimitInput.addEventListener('change', (e) => {
        const val = Number(e.target.value) || 0;
        state.budgetLimit = convertToBase(val, state.currency);
        saveState();
        updateUI();
    });

    DOMElements.daysLeftInput.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '') {
            // If cleared, reset logic will trigger default calculation
            state.lastUpdatedDate = null;
            handleDaysLeftLogic();
        } else {
            state.daysLeft = Number(val) || 0;
            state.lastUpdatedDate = getLocalDateString();
            saveState();
        }
        updateUI();
    });



    DOMElements.savingsGoalInput.addEventListener('change', (e) => {
        const val = Number(e.target.value) || 0;
        state.savingsGoal = convertToBase(val, state.currency);
        saveState();
        updateUI();
    });

    DOMElements.tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOMElements.tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.transactionType = e.target.dataset.type;

            if (state.transactionType === 'income') {
                DOMElements.categoryGroup.classList.add('hidden');
                DOMElements.budgetToggleGroup.classList.remove('hidden');
                DOMElements.transactionDesc.placeholder = "e.g. Salary, Part-time job";
            } else {
                DOMElements.categoryGroup.classList.remove('hidden');
                DOMElements.budgetToggleGroup.classList.add('hidden');
                DOMElements.transactionDesc.placeholder = "e.g. Lunch at canteen";
            }
        });
    });

    DOMElements.cancelEditBtn.addEventListener('click', () => {
        cancelEdit();
    });

    DOMElements.savingsModeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.savingsMode = e.target.dataset.mode;
            saveState();
            updateUI();
        });
    });

    DOMElements.addTransactionForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const desc = DOMElements.transactionDesc.value.trim();
        const inputAmount = Number(DOMElements.transactionAmount.value);
        const category = state.transactionType === 'expense' ? DOMElements.transactionCategory.value : null;

        if (desc && inputAmount > 0) {
            const baseAmountLKR = convertToBase(inputAmount, state.currency);
            const inputTime = DOMElements.transactionTime.value;
            const timestamp = inputTime ? new Date(inputTime).getTime() : Date.now();

            if (state.editingId) {
                // Update existing
                const index = state.transactions.findIndex(t => t.id === state.editingId);
                if (index !== -1) {
                    state.transactions[index] = {
                        ...state.transactions[index],
                        desc,
                        amount: baseAmountLKR,
                        type: state.transactionType,
                        category,
                        timestamp
                    };
                    showToast('Transaction updated!', 'success');
                }
                cancelEdit();
            } else {
                // Add new
                // Set inBudget: expenses are always inBudget, incomes use the form toggle
                const inBudget = state.transactionType === 'expense' || DOMElements.formInBudgetToggle.checked;

                const transaction = {
                    id: Date.now().toString(),
                    desc,
                    amount: baseAmountLKR,
                    type: state.transactionType,
                    category,
                    timestamp,
                    inBudget: inBudget
                };
                state.transactions.push(transaction);
                showToast(`${state.transactionType === 'income' ? 'Income' : 'Expense'} added!`, 'success');

                // Reset form toggle
                DOMElements.formInBudgetToggle.checked = false;
            }

            saveState();
            state.currentWindow = getWindowIdx(timestamp); // Jump to the window of the added/edited transaction
            updateUI();

            if (!state.editingId) {
                DOMElements.transactionDesc.value = '';
                DOMElements.transactionAmount.value = '';
                setDefaultTime();
            }
        }
    });

    DOMElements.exportCsvBtn.addEventListener('click', () => {
        if (state.transactions.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Date,Time,Description,Type,Category,Amount (${state.currency})\n`;

        state.transactions.forEach(t => {
            const dateObj = new Date(t.timestamp);
            const date = dateObj.toLocaleDateString();
            const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const convertedAmount = convertFromBase(t.amount, state.currency).toFixed(2);
            csvContent += `${date},${time},${t.desc},${t.type},${t.category || ''},${convertedAmount}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "finance_tracker_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    DOMElements.exportPdfBtn.addEventListener('click', async () => {
        if (state.transactions.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Group transactions by window
        const windows = {};
        state.transactions.forEach(t => {
            const idx = getWindowIdx(t.timestamp);
            if (!windows[idx]) windows[idx] = [];
            windows[idx].push(t);
        });

        const sortedWindowIndices = Object.keys(windows).map(Number).sort((a, b) => a - b);
        
        let firstPage = true;
        for (const idx of sortedWindowIndices) {
            if (!firstPage) doc.addPage();
            firstPage = false;

            // Title & Info
            doc.setFontSize(22);
            doc.setTextColor(6, 182, 212); // Cyan Primary Color
            doc.text("Finance Tracker Report", 14, 22);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Text Secondary
            doc.text(`User: ${state.user}`, 14, 32);
            doc.text(`Period: Days ${idx * 3} to ${idx * 3 + 2} ago`, 14, 37);
            doc.text(`Currency: ${state.currency}`, 14, 42);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 47);

            // Table
            const tableData = windows[idx].sort((a, b) => b.timestamp - a.timestamp).map(t => [
                new Date(t.timestamp).toLocaleDateString(),
                new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                t.desc,
                t.type === 'expense' ? t.category : 'Income',
                `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`,
                t.type.toUpperCase()
            ]);

            doc.autoTable({
                startY: 55,
                head: [['Date', 'Time', 'Description', 'Category', 'Amount', 'Type']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 4 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 55 }
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.text(`Page ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
        }

        const safeUsername = (state.user || "Student").replace(/[^a-z0-9]/gi, '_');
        doc.save(`Finance_Report_${safeUsername}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF Exported Successfully!', 'success');
    });

    DOMElements.prevPageBtn.addEventListener('click', () => {
        if (state.currentWindow > 0) {
            state.currentWindow--;
            renderTransactions();
        }
    });

    DOMElements.nextPageBtn.addEventListener('click', () => {
        const maxWindow = state.transactions.reduce((max, t) => Math.max(max, getWindowIdx(t.timestamp)), 0);
        
        if (state.currentWindow < maxWindow) {
            state.currentWindow++;
            renderTransactions();
        }
    });

    DOMElements.resetDataBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete all transaction data? This cannot be undone.")) {
            state.transactions = [];
            saveState();
            updateUI();
            showToast('Data reset successfully', 'success');
        }
    });
}

function applyTheme() {
    const isDark = state.theme === 'dark';
    if (isDark) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
    DOMElements.themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';

    // Set active button for chart filters based on state
    DOMElements.filterBtns.forEach(b => {
        if (parseInt(b.dataset.days) === state.chartTimeFilter) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function showApp() {
    DOMElements.appContainer.classList.remove('hidden');
    const fadeIns = document.querySelectorAll('.fade-in');
    fadeIns.forEach((el, index) => {
        el.style.animationDelay = `${index * 0.1}s`;
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    DOMElements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
