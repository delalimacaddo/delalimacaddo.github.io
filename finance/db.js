/**
 * Private Wealth OS — IndexedDB Data Layer
 * Client-side implementation of the financial database schema.
 */

const DB_NAME = 'PrivateWealthOS';
const DB_VERSION = 1;

const STORES = {
  accounts: 'accounts',
  transactions: 'transactions',
  categories: 'categories',
  budgetBuckets: 'budgetBuckets',
  goals: 'goals',
  givingFunds: 'givingFunds',
  assets: 'assets',
  holdings: 'holdings',
  snapshots: 'snapshots',
};

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Accounts
      if (!db.objectStoreNames.contains(STORES.accounts)) {
        const s = db.createObjectStore(STORES.accounts, { keyPath: 'id' });
        s.createIndex('byType', 'accountType', { unique: false });
        s.createIndex('byActive', 'isActive', { unique: false });
      }

      // Transactions
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        const s = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
        s.createIndex('byAccount', 'accountId', { unique: false });
        s.createIndex('byCategory', 'categoryId', { unique: false });
        s.createIndex('byDate', 'transactionTs', { unique: false });
        s.createIndex('byType', 'transactionType', { unique: false });
      }

      // Categories
      if (!db.objectStoreNames.contains(STORES.categories)) {
        const s = db.createObjectStore(STORES.categories, { keyPath: 'id' });
        s.createIndex('byType', 'categoryType', { unique: false });
      }

      // Budget Buckets
      if (!db.objectStoreNames.contains(STORES.budgetBuckets)) {
        const s = db.createObjectStore(STORES.budgetBuckets, { keyPath: 'id' });
        s.createIndex('byActive', 'isActive', { unique: false });
      }

      // Goals
      if (!db.objectStoreNames.contains(STORES.goals)) {
        const s = db.createObjectStore(STORES.goals, { keyPath: 'id' });
        s.createIndex('byStatus', 'status', { unique: false });
        s.createIndex('byType', 'goalType', { unique: false });
      }

      // Giving Funds
      if (!db.objectStoreNames.contains(STORES.givingFunds)) {
        const s = db.createObjectStore(STORES.givingFunds, { keyPath: 'id' });
        s.createIndex('byActive', 'isActive', { unique: false });
      }

      // Assets
      if (!db.objectStoreNames.contains(STORES.assets)) {
        const s = db.createObjectStore(STORES.assets, { keyPath: 'id' });
        s.createIndex('bySymbol', 'symbol', { unique: false });
        s.createIndex('byType', 'assetType', { unique: false });
      }

      // Holdings
      if (!db.objectStoreNames.contains(STORES.holdings)) {
        const s = db.createObjectStore(STORES.holdings, { keyPath: 'id' });
        s.createIndex('byAccount', 'accountId', { unique: false });
      }

      // Portfolio Snapshots
      if (!db.objectStoreNames.contains(STORES.snapshots)) {
        const s = db.createObjectStore(STORES.snapshots, { keyPath: 'id' });
        s.createIndex('byDate', 'snapshotTs', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Generic CRUD helpers ── */

async function dbPut(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => { db.close(); resolve(record); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/* ── Domain API ── */

const AccountTypes = ['checking', 'savings', 'credit', 'brokerage', 'retirement', 'crypto', 'cash', 'loan', 'other'];
const CategoryTypes = ['income', 'expense', 'transfer', 'investment', 'giving', 'savings'];
const TransactionTypes = ['income', 'expense', 'transfer', 'investment_buy', 'investment_sell', 'dividend', 'interest', 'fee', 'tax', 'giving', 'bucket_allocation', 'adjustment'];
const GoalTypes = ['savings', 'investment', 'giving', 'net_worth'];
const GoalStatuses = ['active', 'paused', 'completed', 'cancelled'];

const DB = {
  /* Accounts */
  async createAccount({ accountName, accountType, currencyCode = 'USD', institution = '', accountMask = '', isManual = true }) {
    const record = {
      id: uid(),
      accountName,
      accountType,
      currencyCode,
      institution,
      accountMask,
      isManual,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    return dbPut(STORES.accounts, record);
  },

  async updateAccount(id, updates) {
    const existing = await dbGet(STORES.accounts, id);
    if (!existing) throw new Error('Account not found');
    const record = { ...existing, ...updates, updatedAt: now() };
    return dbPut(STORES.accounts, record);
  },

  getAccount: (id) => dbGet(STORES.accounts, id),
  getAllAccounts: () => dbGetAll(STORES.accounts),
  deleteAccount: (id) => dbDelete(STORES.accounts, id),

  /* Categories */
  async createCategory({ name, categoryType, parentCategoryId = null }) {
    const record = {
      id: uid(),
      name,
      categoryType,
      parentCategoryId,
      isSystem: false,
      createdAt: now(),
    };
    return dbPut(STORES.categories, record);
  },

  getAllCategories: () => dbGetAll(STORES.categories),
  deleteCategory: (id) => dbDelete(STORES.categories, id),

  async seedDefaultCategories() {
    const existing = await dbGetAll(STORES.categories);
    if (existing.length > 0) return;

    const defaults = [
      { name: 'Salary', categoryType: 'income' },
      { name: 'Freelance', categoryType: 'income' },
      { name: 'Investment Income', categoryType: 'income' },
      { name: 'Other Income', categoryType: 'income' },
      { name: 'Housing', categoryType: 'expense' },
      { name: 'Transportation', categoryType: 'expense' },
      { name: 'Food & Dining', categoryType: 'expense' },
      { name: 'Utilities', categoryType: 'expense' },
      { name: 'Healthcare', categoryType: 'expense' },
      { name: 'Entertainment', categoryType: 'expense' },
      { name: 'Shopping', categoryType: 'expense' },
      { name: 'Education', categoryType: 'expense' },
      { name: 'Personal Care', categoryType: 'expense' },
      { name: 'Insurance', categoryType: 'expense' },
      { name: 'Subscriptions', categoryType: 'expense' },
      { name: 'Other Expense', categoryType: 'expense' },
      { name: 'Tithe / Giving', categoryType: 'giving' },
      { name: 'Charity', categoryType: 'giving' },
      { name: 'Savings Transfer', categoryType: 'savings' },
      { name: 'Account Transfer', categoryType: 'transfer' },
    ];

    for (const cat of defaults) {
      await DB.createCategory(cat);
    }
  },

  /* Transactions */
  async createTransaction({ accountId, transactionTs, amount, currencyCode = 'USD', direction, transactionType, categoryId = null, bucketId = null, givingFundId = null, description = '', merchantName = '' }) {
    const record = {
      id: uid(),
      accountId,
      transactionTs,
      postedDate: transactionTs.split('T')[0],
      amount: parseFloat(amount),
      currencyCode,
      direction,
      transactionType,
      status: 'posted',
      categoryId,
      bucketId,
      givingFundId,
      description,
      merchantName,
      createdAt: now(),
      updatedAt: now(),
    };
    return dbPut(STORES.transactions, record);
  },

  async updateTransaction(id, updates) {
    const existing = await dbGet(STORES.transactions, id);
    if (!existing) throw new Error('Transaction not found');
    if (updates.amount !== undefined) updates.amount = parseFloat(updates.amount);
    const record = { ...existing, ...updates, updatedAt: now() };
    return dbPut(STORES.transactions, record);
  },

  getTransaction: (id) => dbGet(STORES.transactions, id),
  getAllTransactions: () => dbGetAll(STORES.transactions),
  getTransactionsByAccount: (accountId) => dbGetByIndex(STORES.transactions, 'byAccount', accountId),
  deleteTransaction: (id) => dbDelete(STORES.transactions, id),

  /* Budget Buckets */
  async createBucket({ name, currencyCode = 'USD', targetAmount = null, priorityRank = 100 }) {
    const record = {
      id: uid(),
      name,
      currencyCode,
      targetAmount: targetAmount ? parseFloat(targetAmount) : null,
      currentAmount: 0,
      priorityRank,
      isActive: true,
      createdAt: now(),
    };
    return dbPut(STORES.budgetBuckets, record);
  },

  async updateBucket(id, updates) {
    const existing = await dbGet(STORES.budgetBuckets, id);
    if (!existing) throw new Error('Bucket not found');
    if (updates.targetAmount !== undefined) updates.targetAmount = updates.targetAmount ? parseFloat(updates.targetAmount) : null;
    if (updates.currentAmount !== undefined) updates.currentAmount = parseFloat(updates.currentAmount);
    const record = { ...existing, ...updates };
    return dbPut(STORES.budgetBuckets, record);
  },

  getBucket: (id) => dbGet(STORES.budgetBuckets, id),
  getAllBuckets: () => dbGetAll(STORES.budgetBuckets),
  deleteBucket: (id) => dbDelete(STORES.budgetBuckets, id),

  /* Goals */
  async createGoal({ name, goalType, currencyCode = 'USD', targetAmount, targetDate = null, bucketId = null }) {
    const record = {
      id: uid(),
      name,
      goalType,
      currencyCode,
      targetAmount: parseFloat(targetAmount),
      targetDate,
      bucketId,
      status: 'active',
      createdAt: now(),
    };
    return dbPut(STORES.goals, record);
  },

  async updateGoal(id, updates) {
    const existing = await dbGet(STORES.goals, id);
    if (!existing) throw new Error('Goal not found');
    if (updates.targetAmount !== undefined) updates.targetAmount = parseFloat(updates.targetAmount);
    const record = { ...existing, ...updates };
    return dbPut(STORES.goals, record);
  },

  getGoal: (id) => dbGet(STORES.goals, id),
  getAllGoals: () => dbGetAll(STORES.goals),
  deleteGoal: (id) => dbDelete(STORES.goals, id),

  /* Giving Funds */
  async createGivingFund({ name, currencyCode = 'USD', targetPercent = null }) {
    const record = {
      id: uid(),
      name,
      currencyCode,
      targetPercent: targetPercent ? parseFloat(targetPercent) : null,
      currentBalance: 0,
      isActive: true,
      createdAt: now(),
    };
    return dbPut(STORES.givingFunds, record);
  },

  async updateGivingFund(id, updates) {
    const existing = await dbGet(STORES.givingFunds, id);
    if (!existing) throw new Error('Giving fund not found');
    const record = { ...existing, ...updates };
    return dbPut(STORES.givingFunds, record);
  },

  getAllGivingFunds: () => dbGetAll(STORES.givingFunds),
  deleteGivingFund: (id) => dbDelete(STORES.givingFunds, id),

  /* ── Computed Queries ── */

  async getAccountBalance(accountId) {
    const txns = await DB.getTransactionsByAccount(accountId);
    return txns
      .filter(t => t.status === 'posted')
      .reduce((sum, t) => sum + (t.direction === 'inflow' ? t.amount : -t.amount), 0);
  },

  async getNetWorth() {
    const accounts = await DB.getAllAccounts();
    let total = 0;
    for (const acct of accounts) {
      if (!acct.isActive) continue;
      const bal = await DB.getAccountBalance(acct.id);
      total += bal;
    }
    return total;
  },

  async getMonthlyCashflow(year, month) {
    const txns = await DB.getAllTransactions();
    const filtered = txns.filter(t => {
      if (t.status !== 'posted') return false;
      const d = new Date(t.transactionTs);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    let income = 0;
    let expenses = 0;
    for (const t of filtered) {
      if (t.transactionType === 'income') income += t.amount;
      else if (t.transactionType === 'expense') expenses += t.amount;
    }
    return { income, expenses, net: income - expenses, savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0 };
  },

  async getCashflowByCategory(year, month) {
    const txns = await DB.getAllTransactions();
    const categories = await DB.getAllCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    const result = {};
    for (const t of txns) {
      if (t.status !== 'posted') continue;
      const d = new Date(t.transactionTs);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;

      const catName = t.categoryId && catMap[t.categoryId] ? catMap[t.categoryId].name : 'Uncategorized';
      if (!result[catName]) result[catName] = { income: 0, expense: 0 };
      if (t.direction === 'inflow') result[catName].income += t.amount;
      else result[catName].expense += t.amount;
    }
    return result;
  },

  async getGoalProgress() {
    const goals = await DB.getAllGoals();
    const buckets = await DB.getAllBuckets();
    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));

    return goals.map(g => {
      let currentAmount = 0;
      if (g.bucketId && bucketMap[g.bucketId]) {
        currentAmount = bucketMap[g.bucketId].currentAmount;
      }
      const progressPct = g.targetAmount > 0 ? (currentAmount / g.targetAmount) * 100 : 0;
      return { ...g, currentAmount, progressPct: Math.min(progressPct, 100) };
    });
  },

  /* ── Data Export/Import ── */

  async exportAll() {
    const data = {};
    for (const [key, storeName] of Object.entries(STORES)) {
      data[key] = await dbGetAll(storeName);
    }
    return data;
  },

  async importAll(data) {
    for (const [key, storeName] of Object.entries(STORES)) {
      if (data[key]) {
        for (const record of data[key]) {
          await dbPut(storeName, record);
        }
      }
    }
  },

  async clearAll() {
    const db = await openDB();
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    for (const storeName of Object.values(STORES)) {
      tx.objectStore(storeName).clear();
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  // Constants for UI
  AccountTypes,
  CategoryTypes,
  TransactionTypes,
  GoalTypes,
  GoalStatuses,
};
