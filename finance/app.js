/**
 * Private Wealth OS — Application Logic
 * Handles navigation, modals, CRUD for all entities, dashboard rendering.
 */

(function () {
  'use strict';

  /* ── Helpers ── */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function fmt(n, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtShortDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Navigation ── */

  const sidebar = $('#sidebar');
  const menuToggle = $('#menuToggle');
  const navBtns = $$('.nav-btn[data-view]');
  const views = $$('.view');

  function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    const targetView = $(`#view-${viewId}`);
    const targetBtn = $(`.nav-btn[data-view="${viewId}"]`);
    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    // Close mobile sidebar
    sidebar.classList.remove('open');
    // Refresh view data
    refreshView(viewId);
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  if (menuToggle) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    }
  });

  /* ── Modal ── */

  const modalOverlay = $('#modalOverlay');
  const modalTitle = $('#modalTitle');
  const modalForm = $('#modalForm');
  const modalClose = $('#modalClose');
  const modalCancel = $('#modalCancel');
  const modalSave = $('#modalSave');
  let currentModalSave = null;

  function openModal(title, formHtml, onSave) {
    modalTitle.textContent = title;
    modalForm.innerHTML = formHtml;
    currentModalSave = onSave;
    modalOverlay.hidden = false;
    // Focus first input
    const firstInput = modalForm.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeModal() {
    modalOverlay.hidden = true;
    currentModalSave = null;
    modalForm.innerHTML = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalSave.addEventListener('click', () => {
    if (currentModalSave) currentModalSave();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  /* ── Refresh dispatcher ── */

  async function refreshView(viewId) {
    switch (viewId) {
      case 'dashboard': await renderDashboard(); break;
      case 'accounts': await renderAccounts(); break;
      case 'transactions': await renderTransactions(); break;
      case 'budgets': await renderBuckets(); break;
      case 'goals': await renderGoals(); break;
      case 'giving': await renderGiving(); break;
    }
  }

  /* ── DASHBOARD ── */

  async function renderDashboard() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    $('#dashboardDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // KPIs
    const netWorth = await DB.getNetWorth();
    const cashflow = await DB.getMonthlyCashflow(year, month);
    $('#kpiNetWorth').textContent = fmt(netWorth);
    $('#kpiIncome').textContent = fmt(cashflow.income);
    $('#kpiExpenses').textContent = fmt(cashflow.expenses);
    $('#kpiSavingsRate').textContent = `${cashflow.savingsRate.toFixed(1)}%`;

    // Accounts list
    const accounts = await DB.getAllAccounts();
    const dashAccounts = $('#dashAccountsList');
    if (accounts.length === 0) {
      dashAccounts.innerHTML = '<div class="empty-state" style="padding:1rem">No accounts added yet</div>';
    } else {
      let html = '';
      for (const acct of accounts.filter(a => a.isActive)) {
        const bal = await DB.getAccountBalance(acct.id);
        html += `<div class="dash-item">
          <div><div class="dash-item-label">${escHtml(acct.accountName)}</div><div class="dash-item-sub">${escHtml(acct.accountType)}</div></div>
          <div class="dash-item-value ${bal >= 0 ? 'positive' : 'negative'}">${fmt(bal, acct.currencyCode)}</div>
        </div>`;
      }
      dashAccounts.innerHTML = html;
    }

    // Recent transactions
    const allTxns = await DB.getAllTransactions();
    allTxns.sort((a, b) => new Date(b.transactionTs) - new Date(a.transactionTs));
    const recent = allTxns.slice(0, 5);
    const dashTxns = $('#dashRecentTxns');
    if (recent.length === 0) {
      dashTxns.innerHTML = '<div class="empty-state" style="padding:1rem">No transactions yet</div>';
    } else {
      const categories = await DB.getAllCategories();
      const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
      let html = '';
      for (const t of recent) {
        const sign = t.direction === 'inflow' ? '+' : '-';
        const cls = t.direction === 'inflow' ? 'positive' : 'negative';
        html += `<div class="dash-item">
          <div><div class="dash-item-label">${escHtml(t.description || t.merchantName || t.transactionType)}</div><div class="dash-item-sub">${fmtShortDate(t.transactionTs)} &middot; ${catMap[t.categoryId] || ''}</div></div>
          <div class="dash-item-value ${cls}">${sign}${fmt(t.amount)}</div>
        </div>`;
      }
      dashTxns.innerHTML = html;
    }

    // Budget progress
    const buckets = await DB.getAllBuckets();
    const dashBuckets = $('#dashBucketsList');
    if (buckets.filter(b => b.isActive).length === 0) {
      dashBuckets.innerHTML = '<div class="empty-state" style="padding:1rem">No budget buckets yet</div>';
    } else {
      let html = '';
      for (const b of buckets.filter(b => b.isActive)) {
        const pct = b.targetAmount ? Math.min((b.currentAmount / b.targetAmount) * 100, 100) : 0;
        html += `<div class="dash-item" style="flex-direction:column;align-items:stretch;gap:0.4rem">
          <div style="display:flex;justify-content:space-between"><span class="dash-item-label">${escHtml(b.name)}</span><span class="dash-item-sub">${fmt(b.currentAmount)} / ${b.targetAmount ? fmt(b.targetAmount) : '&mdash;'}</span></div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div></div>
        </div>`;
      }
      dashBuckets.innerHTML = html;
    }

    // Goal progress
    const goalProgress = await DB.getGoalProgress();
    const dashGoals = $('#dashGoalsList');
    if (goalProgress.length === 0) {
      dashGoals.innerHTML = '<div class="empty-state" style="padding:1rem">No goals yet</div>';
    } else {
      let html = '';
      for (const g of goalProgress.filter(g => g.status === 'active')) {
        html += `<div class="dash-item" style="flex-direction:column;align-items:stretch;gap:0.4rem">
          <div style="display:flex;justify-content:space-between"><span class="dash-item-label">${escHtml(g.name)}</span><span class="dash-item-sub">${g.progressPct.toFixed(0)}%</span></div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill ${g.progressPct >= 100 ? 'complete' : ''}" style="width:${g.progressPct}%"></div></div>
        </div>`;
      }
      dashGoals.innerHTML = html || '<div class="empty-state" style="padding:1rem">No active goals</div>';
    }

    // Spending by category
    const catBreakdown = await DB.getCashflowByCategory(year, month);
    const dashCat = $('#dashCategoryBreakdown');
    const expenseEntries = Object.entries(catBreakdown)
      .filter(([, v]) => v.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense);

    if (expenseEntries.length === 0) {
      dashCat.innerHTML = '<div class="empty-state" style="padding:1rem">No expense data this month</div>';
    } else {
      const maxExpense = expenseEntries[0][1].expense;
      let html = '';
      for (const [catName, data] of expenseEntries) {
        const pct = (data.expense / maxExpense) * 100;
        html += `<div class="cat-bar-row">
          <span class="cat-bar-label">${escHtml(catName)}</span>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
          <span class="cat-bar-amount">${fmt(data.expense)}</span>
        </div>`;
      }
      dashCat.innerHTML = html;
    }
  }

  /* ── ACCOUNTS ── */

  async function renderAccounts() {
    const accounts = await DB.getAllAccounts();
    const tbody = $('#accountsBody');
    const emptyState = $('#accountsEmpty');

    if (accounts.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    let html = '';
    for (const acct of accounts) {
      const bal = await DB.getAccountBalance(acct.id);
      html += `<tr>
        <td><strong>${escHtml(acct.accountName)}</strong></td>
        <td><span class="badge-pill badge-type">${escHtml(acct.accountType)}</span></td>
        <td>${escHtml(acct.institution || '—')}</td>
        <td>${escHtml(acct.currencyCode)}</td>
        <td class="amount-cell ${bal >= 0 ? 'inflow' : 'outflow'}">${fmt(bal, acct.currencyCode)}</td>
        <td><span class="badge-pill ${acct.isActive ? 'badge-active' : 'badge-inactive'}">${acct.isActive ? 'Active' : 'Closed'}</span></td>
        <td>
          <button class="btn btn-sm btn-ghost" data-edit-account="${acct.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-delete-account="${acct.id}">Del</button>
        </td>
      </tr>`;
    }
    tbody.innerHTML = html;

    // Bind edit/delete
    $$('[data-edit-account]', tbody).forEach(btn => {
      btn.addEventListener('click', () => openAccountModal(btn.dataset.editAccount));
    });
    $$('[data-delete-account]', tbody).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this account? Transactions linked to it will remain.')) {
          await DB.deleteAccount(btn.dataset.deleteAccount);
          await renderAccounts();
        }
      });
    });
  }

  function accountFormHtml(acct) {
    const typeOptions = DB.AccountTypes.map(t =>
      `<option value="${t}" ${acct && acct.accountType === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label class="form-label" for="accName">Account Name</label>
        <input class="input" id="accName" type="text" value="${acct ? escHtml(acct.accountName) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="accType">Type</label>
          <select class="input" id="accType">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="accCurrency">Currency</label>
          <input class="input" id="accCurrency" type="text" maxlength="3" value="${acct ? acct.currencyCode : 'USD'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="accInstitution">Institution</label>
        <input class="input" id="accInstitution" type="text" value="${acct ? escHtml(acct.institution || '') : ''}">
      </div>
    `;
  }

  async function openAccountModal(editId) {
    const acct = editId ? await DB.getAccount(editId) : null;
    openModal(acct ? 'Edit Account' : 'New Account', accountFormHtml(acct), async () => {
      const name = $('#accName').value.trim();
      if (!name) return alert('Account name is required.');
      const data = {
        accountName: name,
        accountType: $('#accType').value,
        currencyCode: $('#accCurrency').value.toUpperCase() || 'USD',
        institution: $('#accInstitution').value.trim(),
      };
      if (acct) {
        await DB.updateAccount(acct.id, data);
      } else {
        await DB.createAccount(data);
      }
      closeModal();
      await renderAccounts();
    });
  }

  $('#btnAddAccount').addEventListener('click', () => openAccountModal(null));

  /* ── TRANSACTIONS ── */

  async function renderTransactions() {
    const allTxns = await DB.getAllTransactions();
    const accounts = await DB.getAllAccounts();
    const categories = await DB.getAllCategories();
    const acctMap = Object.fromEntries(accounts.map(a => [a.id, a]));
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    // Populate filter dropdowns
    const acctSelect = $('#txnFilterAccount');
    const currentAcctFilter = acctSelect.value;
    acctSelect.innerHTML = '<option value="">All Accounts</option>' +
      accounts.map(a => `<option value="${a.id}" ${a.id === currentAcctFilter ? 'selected' : ''}>${escHtml(a.accountName)}</option>`).join('');

    // Apply filters
    const filterAcct = $('#txnFilterAccount').value;
    const filterType = $('#txnFilterType').value;
    const filterMonth = $('#txnFilterMonth').value;

    let filtered = allTxns;
    if (filterAcct) filtered = filtered.filter(t => t.accountId === filterAcct);
    if (filterType) filtered = filtered.filter(t => t.transactionType === filterType);
    if (filterMonth) {
      const [fy, fm] = filterMonth.split('-').map(Number);
      filtered = filtered.filter(t => {
        const d = new Date(t.transactionTs);
        return d.getFullYear() === fy && d.getMonth() === fm - 1;
      });
    }

    filtered.sort((a, b) => new Date(b.transactionTs) - new Date(a.transactionTs));

    const tbody = $('#transactionsBody');
    const emptyState = $('#transactionsEmpty');

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    let html = '';
    for (const t of filtered) {
      const acctName = acctMap[t.accountId] ? acctMap[t.accountId].accountName : '—';
      const catName = catMap[t.categoryId] ? catMap[t.categoryId].name : '—';
      const sign = t.direction === 'inflow' ? '+' : '-';
      const cls = t.direction === 'inflow' ? 'inflow' : 'outflow';
      html += `<tr>
        <td>${fmtDate(t.transactionTs)}</td>
        <td>${escHtml(t.description || t.merchantName || '—')}</td>
        <td>${escHtml(catName)}</td>
        <td>${escHtml(acctName)}</td>
        <td class="amount-cell ${cls}">${sign}${fmt(t.amount)}</td>
        <td><span class="badge-pill badge-type">${escHtml(t.transactionType)}</span></td>
        <td>
          <button class="btn btn-sm btn-ghost" data-edit-txn="${t.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-delete-txn="${t.id}">Del</button>
        </td>
      </tr>`;
    }
    tbody.innerHTML = html;

    $$('[data-edit-txn]', tbody).forEach(btn => {
      btn.addEventListener('click', () => openTransactionModal(btn.dataset.editTxn));
    });
    $$('[data-delete-txn]', tbody).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this transaction?')) {
          await DB.deleteTransaction(btn.dataset.deleteTxn);
          await renderTransactions();
        }
      });
    });
  }

  async function transactionFormHtml(txn) {
    const accounts = await DB.getAllAccounts();
    const categories = await DB.getAllCategories();

    const acctOptions = accounts.map(a =>
      `<option value="${a.id}" ${txn && txn.accountId === a.id ? 'selected' : ''}>${escHtml(a.accountName)}</option>`
    ).join('');

    const catOptions = '<option value="">—</option>' + categories.map(c =>
      `<option value="${c.id}" ${txn && txn.categoryId === c.id ? 'selected' : ''}>${escHtml(c.name)} (${c.categoryType})</option>`
    ).join('');

    const typeOptions = DB.TransactionTypes.map(t =>
      `<option value="${t}" ${txn && txn.transactionType === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    const dateVal = txn ? txn.transactionTs.slice(0, 16) : new Date().toISOString().slice(0, 16);

    return `
      <div class="form-group">
        <label class="form-label" for="txnAccount">Account</label>
        <select class="input" id="txnAccount" required>${acctOptions}</select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="txnDate">Date</label>
          <input class="input" id="txnDate" type="datetime-local" value="${dateVal}">
        </div>
        <div class="form-group">
          <label class="form-label" for="txnAmount">Amount</label>
          <input class="input" id="txnAmount" type="number" step="0.01" min="0" value="${txn ? txn.amount : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="txnDirection">Direction</label>
          <select class="input" id="txnDirection">
            <option value="inflow" ${txn && txn.direction === 'inflow' ? 'selected' : ''}>Inflow</option>
            <option value="outflow" ${!txn || txn.direction === 'outflow' ? 'selected' : ''}>Outflow</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="txnType">Type</label>
          <select class="input" id="txnType">${typeOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="txnCategory">Category</label>
        <select class="input" id="txnCategory">${catOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="txnDesc">Description</label>
        <input class="input" id="txnDesc" type="text" value="${txn ? escHtml(txn.description || '') : ''}">
      </div>
      <div class="form-group">
        <label class="form-label" for="txnMerchant">Merchant</label>
        <input class="input" id="txnMerchant" type="text" value="${txn ? escHtml(txn.merchantName || '') : ''}">
      </div>
    `;
  }

  async function openTransactionModal(editId) {
    const txn = editId ? await DB.getTransaction(editId) : null;
    const accounts = await DB.getAllAccounts();
    if (accounts.length === 0) return alert('Create an account first.');

    const html = await transactionFormHtml(txn);
    openModal(txn ? 'Edit Transaction' : 'New Transaction', html, async () => {
      const accountId = $('#txnAccount').value;
      const amount = $('#txnAmount').value;
      if (!accountId || !amount) return alert('Account and amount are required.');

      const data = {
        accountId,
        transactionTs: new Date($('#txnDate').value || Date.now()).toISOString(),
        amount,
        direction: $('#txnDirection').value,
        transactionType: $('#txnType').value,
        categoryId: $('#txnCategory').value || null,
        description: $('#txnDesc').value.trim(),
        merchantName: $('#txnMerchant').value.trim(),
      };

      if (txn) {
        await DB.updateTransaction(txn.id, data);
      } else {
        await DB.createTransaction(data);
      }
      closeModal();
      await renderTransactions();
    });
  }

  $('#btnAddTransaction').addEventListener('click', () => openTransactionModal(null));

  // Transaction filters
  ['txnFilterAccount', 'txnFilterType', 'txnFilterMonth'].forEach(id => {
    $(`#${id}`).addEventListener('change', () => renderTransactions());
  });

  /* ── BUDGET BUCKETS ── */

  async function renderBuckets() {
    const buckets = await DB.getAllBuckets();
    const grid = $('#bucketsGrid');
    const emptyState = $('#bucketsEmpty');

    if (buckets.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    let html = '';
    for (const b of buckets) {
      const pct = b.targetAmount ? Math.min((b.currentAmount / b.targetAmount) * 100, 100) : 0;
      html += `<div class="card">
        <div class="card-header">
          <div class="card-title">${escHtml(b.name)}</div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost" data-edit-bucket="${b.id}">Edit</button>
            <button class="btn btn-sm btn-ghost" data-fund-bucket="${b.id}">+ Fund</button>
            <button class="btn btn-sm btn-danger" data-delete-bucket="${b.id}">Del</button>
          </div>
        </div>
        <div class="card-meta">${escHtml(b.currencyCode)} &middot; Priority: ${b.priorityRank}</div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div></div>
        <div class="progress-text">
          <span>${fmt(b.currentAmount, b.currencyCode)} saved</span>
          <span>${b.targetAmount ? fmt(b.targetAmount, b.currencyCode) + ' target' : 'No target'}</span>
        </div>
      </div>`;
    }
    grid.innerHTML = html;

    $$('[data-edit-bucket]', grid).forEach(btn => {
      btn.addEventListener('click', () => openBucketModal(btn.dataset.editBucket));
    });
    $$('[data-fund-bucket]', grid).forEach(btn => {
      btn.addEventListener('click', () => openFundBucketModal(btn.dataset.fundBucket));
    });
    $$('[data-delete-bucket]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this bucket?')) {
          await DB.deleteBucket(btn.dataset.deleteBucket);
          await renderBuckets();
        }
      });
    });
  }

  function bucketFormHtml(bucket) {
    return `
      <div class="form-group">
        <label class="form-label" for="bucketName">Name</label>
        <input class="input" id="bucketName" type="text" value="${bucket ? escHtml(bucket.name) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="bucketTarget">Target Amount</label>
          <input class="input" id="bucketTarget" type="number" step="0.01" min="0" value="${bucket && bucket.targetAmount ? bucket.targetAmount : ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="bucketCurrency">Currency</label>
          <input class="input" id="bucketCurrency" type="text" maxlength="3" value="${bucket ? bucket.currencyCode : 'USD'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="bucketPriority">Priority (lower = higher priority)</label>
        <input class="input" id="bucketPriority" type="number" min="1" value="${bucket ? bucket.priorityRank : 100}">
      </div>
    `;
  }

  async function openBucketModal(editId) {
    const bucket = editId ? await DB.getBucket(editId) : null;
    openModal(bucket ? 'Edit Bucket' : 'New Bucket', bucketFormHtml(bucket), async () => {
      const name = $('#bucketName').value.trim();
      if (!name) return alert('Name is required.');
      const data = {
        name,
        targetAmount: $('#bucketTarget').value || null,
        currencyCode: $('#bucketCurrency').value.toUpperCase() || 'USD',
        priorityRank: parseInt($('#bucketPriority').value) || 100,
      };
      if (bucket) {
        await DB.updateBucket(bucket.id, data);
      } else {
        await DB.createBucket(data);
      }
      closeModal();
      await renderBuckets();
    });
  }

  async function openFundBucketModal(bucketId) {
    const bucket = await DB.getBucket(bucketId);
    if (!bucket) return;
    openModal(`Fund: ${bucket.name}`, `
      <div class="form-group">
        <label class="form-label" for="fundAmount">Amount to Add</label>
        <input class="input" id="fundAmount" type="number" step="0.01" min="0.01" required>
      </div>
    `, async () => {
      const amount = parseFloat($('#fundAmount').value);
      if (!amount || amount <= 0) return alert('Enter a positive amount.');
      await DB.updateBucket(bucket.id, { currentAmount: bucket.currentAmount + amount });
      closeModal();
      await renderBuckets();
    });
  }

  $('#btnAddBucket').addEventListener('click', () => openBucketModal(null));

  /* ── GOALS ── */

  async function renderGoals() {
    const goalProgress = await DB.getGoalProgress();
    const grid = $('#goalsGrid');
    const emptyState = $('#goalsEmpty');

    if (goalProgress.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    let html = '';
    for (const g of goalProgress) {
      const statusCls = g.status === 'active' ? 'badge-active' : g.status === 'completed' ? 'badge-active' : 'badge-inactive';
      html += `<div class="card">
        <div class="card-header">
          <div class="card-title">${escHtml(g.name)}</div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost" data-edit-goal="${g.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-delete-goal="${g.id}">Del</button>
          </div>
        </div>
        <div class="card-meta">
          <span class="badge-pill badge-type">${escHtml(g.goalType)}</span>
          <span class="badge-pill ${statusCls}">${escHtml(g.status)}</span>
          ${g.targetDate ? ' &middot; Due ' + fmtDate(g.targetDate) : ''}
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill ${g.progressPct >= 100 ? 'complete' : ''}" style="width:${g.progressPct}%"></div></div>
        <div class="progress-text">
          <span>${fmt(g.currentAmount, g.currencyCode)}</span>
          <span>${fmt(g.targetAmount, g.currencyCode)} target</span>
        </div>
      </div>`;
    }
    grid.innerHTML = html;

    $$('[data-edit-goal]', grid).forEach(btn => {
      btn.addEventListener('click', () => openGoalModal(btn.dataset.editGoal));
    });
    $$('[data-delete-goal]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this goal?')) {
          await DB.deleteGoal(btn.dataset.deleteGoal);
          await renderGoals();
        }
      });
    });
  }

  async function goalFormHtml(goal) {
    const buckets = await DB.getAllBuckets();
    const typeOptions = DB.GoalTypes.map(t =>
      `<option value="${t}" ${goal && goal.goalType === t ? 'selected' : ''}>${t}</option>`
    ).join('');
    const statusOptions = DB.GoalStatuses.map(s =>
      `<option value="${s}" ${goal && goal.status === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    const bucketOptions = '<option value="">None</option>' + buckets.map(b =>
      `<option value="${b.id}" ${goal && goal.bucketId === b.id ? 'selected' : ''}>${escHtml(b.name)}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label class="form-label" for="goalName">Goal Name</label>
        <input class="input" id="goalName" type="text" value="${goal ? escHtml(goal.name) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="goalType">Type</label>
          <select class="input" id="goalType">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="goalStatus">Status</label>
          <select class="input" id="goalStatus">${statusOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="goalTarget">Target Amount</label>
          <input class="input" id="goalTarget" type="number" step="0.01" min="0" value="${goal ? goal.targetAmount : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="goalCurrency">Currency</label>
          <input class="input" id="goalCurrency" type="text" maxlength="3" value="${goal ? goal.currencyCode : 'USD'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="goalDate">Target Date</label>
          <input class="input" id="goalDate" type="date" value="${goal && goal.targetDate ? goal.targetDate : ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="goalBucket">Linked Bucket</label>
          <select class="input" id="goalBucket">${bucketOptions}</select>
        </div>
      </div>
    `;
  }

  async function openGoalModal(editId) {
    const goal = editId ? await DB.getGoal(editId) : null;
    const html = await goalFormHtml(goal);
    openModal(goal ? 'Edit Goal' : 'New Goal', html, async () => {
      const name = $('#goalName').value.trim();
      const targetAmount = $('#goalTarget').value;
      if (!name || !targetAmount) return alert('Name and target amount are required.');
      const data = {
        name,
        goalType: $('#goalType').value,
        status: $('#goalStatus').value,
        targetAmount,
        currencyCode: $('#goalCurrency').value.toUpperCase() || 'USD',
        targetDate: $('#goalDate').value || null,
        bucketId: $('#goalBucket').value || null,
      };
      if (goal) {
        await DB.updateGoal(goal.id, data);
      } else {
        await DB.createGoal(data);
      }
      closeModal();
      await renderGoals();
    });
  }

  $('#btnAddGoal').addEventListener('click', () => openGoalModal(null));

  /* ── GIVING FUNDS ── */

  async function renderGiving() {
    const funds = await DB.getAllGivingFunds();
    const grid = $('#givingGrid');
    const emptyState = $('#givingEmpty');

    if (funds.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    let html = '';
    for (const f of funds) {
      html += `<div class="card">
        <div class="card-header">
          <div class="card-title">${escHtml(f.name)}</div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost" data-edit-fund="${f.id}">Edit</button>
            <button class="btn btn-sm btn-ghost" data-add-to-fund="${f.id}">+ Add</button>
            <button class="btn btn-sm btn-danger" data-delete-fund="${f.id}">Del</button>
          </div>
        </div>
        <div class="card-meta">${escHtml(f.currencyCode)} ${f.targetPercent ? '&middot; Target: ' + f.targetPercent + '% of income' : ''}</div>
        <div class="card-amount">${fmt(f.currentBalance, f.currencyCode)}</div>
      </div>`;
    }
    grid.innerHTML = html;

    $$('[data-edit-fund]', grid).forEach(btn => {
      btn.addEventListener('click', () => openGivingFundModal(btn.dataset.editFund));
    });
    $$('[data-add-to-fund]', grid).forEach(btn => {
      btn.addEventListener('click', () => openAddToFundModal(btn.dataset.addToFund));
    });
    $$('[data-delete-fund]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this giving fund?')) {
          await DB.deleteGivingFund(btn.dataset.deleteFund);
          await renderGiving();
        }
      });
    });
  }

  function givingFundFormHtml(fund) {
    return `
      <div class="form-group">
        <label class="form-label" for="fundName">Fund Name</label>
        <input class="input" id="fundName" type="text" value="${fund ? escHtml(fund.name) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="fundCurrency">Currency</label>
          <input class="input" id="fundCurrency" type="text" maxlength="3" value="${fund ? fund.currencyCode : 'USD'}">
        </div>
        <div class="form-group">
          <label class="form-label" for="fundPercent">Target % of Income</label>
          <input class="input" id="fundPercent" type="number" step="0.01" min="0" max="100" value="${fund && fund.targetPercent ? fund.targetPercent : ''}">
        </div>
      </div>
    `;
  }

  async function openGivingFundModal(editId) {
    const fund = editId ? await (async () => {
      const all = await DB.getAllGivingFunds();
      return all.find(f => f.id === editId);
    })() : null;
    openModal(fund ? 'Edit Fund' : 'New Giving Fund', givingFundFormHtml(fund), async () => {
      const name = $('#fundName').value.trim();
      if (!name) return alert('Name is required.');
      const data = {
        name,
        currencyCode: $('#fundCurrency').value.toUpperCase() || 'USD',
        targetPercent: $('#fundPercent').value || null,
      };
      if (fund) {
        await DB.updateGivingFund(fund.id, data);
      } else {
        await DB.createGivingFund(data);
      }
      closeModal();
      await renderGiving();
    });
  }

  async function openAddToFundModal(fundId) {
    const all = await DB.getAllGivingFunds();
    const fund = all.find(f => f.id === fundId);
    if (!fund) return;
    openModal(`Add to: ${fund.name}`, `
      <div class="form-group">
        <label class="form-label" for="addFundAmount">Amount</label>
        <input class="input" id="addFundAmount" type="number" step="0.01" min="0.01" required>
      </div>
    `, async () => {
      const amount = parseFloat($('#addFundAmount').value);
      if (!amount || amount <= 0) return alert('Enter a positive amount.');
      await DB.updateGivingFund(fund.id, { currentBalance: fund.currentBalance + amount });
      closeModal();
      await renderGiving();
    });
  }

  $('#btnAddGivingFund').addEventListener('click', () => openGivingFundModal(null));

  /* ── EXPORT / IMPORT ── */

  $('#btnExport').addEventListener('click', async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealth-os-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFileInput = $('#importFile');
  $('#btnImport').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Import data? This will merge with existing data.')) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await DB.importAll(data);
      alert('Data imported successfully.');
      switchView('dashboard');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    importFileInput.value = '';
  });

  /* ── INIT ── */

  async function init() {
    await DB.seedDefaultCategories();
    await renderDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
