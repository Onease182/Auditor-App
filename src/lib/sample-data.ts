import type { WorkbookRequest } from './accounting'

// A fully worked reference example: a fictional trading firm with 20 journal
// entries (purchases, sales, expenses, drawings) and 4 period-end adjustments.
// Used by the "Load Sample Data" button for one-click demonstration.
export const SAMPLE_DATA: WorkbookRequest = {
  company: {
    name: 'Himalayan Traders Pvt. Ltd.',
    financialYear: '2024-25',
    currency: 'NPR',
    yearEndDate: '31 March 2025',
  },
  entries: [
    {
      id: 's1', date: '2024-04-01', narration: 'Started business with cash as capital',
      legs: [
        { account: 'Cash in Hand', debit: 200000 },
        { account: 'Capital Account', credit: 200000 },
      ],
    },
    {
      id: 's2', date: '2024-04-05', narration: 'Opened bank account and deposited cash',
      legs: [
        { account: 'Bank A/c', debit: 80000 },
        { account: 'Cash in Hand', credit: 80000 },
      ],
    },
    {
      id: 's3', date: '2024-04-10', narration: 'Cash purchase of goods',
      legs: [
        { account: 'Purchases', debit: 30000 },
        { account: 'Cash in Hand', credit: 30000 },
      ],
    },
    {
      id: 's4', date: '2024-04-15', narration: 'Credit purchase of goods from Supplier A',
      legs: [
        { account: 'Purchases', debit: 25000 },
        { account: 'Creditors - Supplier A', credit: 25000 },
      ],
    },
    {
      id: 's5', date: '2024-04-20', narration: 'Credit sale of goods to Customer X',
      legs: [
        { account: 'Debtors - Customer X', debit: 40000 },
        { account: 'Sales', credit: 40000 },
      ],
    },
    {
      id: 's6', date: '2024-05-03', narration: 'Cash sale of goods',
      legs: [
        { account: 'Cash in Hand', debit: 15000 },
        { account: 'Sales', credit: 15000 },
      ],
    },
    {
      id: 's7', date: '2024-05-10', narration: 'Paid shop rent',
      legs: [
        { account: 'Rent Paid', debit: 5000 },
        { account: 'Cash in Hand', credit: 5000 },
      ],
    },
    {
      id: 's8', date: '2024-05-15', narration: 'Paid salary to staff',
      legs: [
        { account: 'Salary', debit: 8000 },
        { account: 'Cash in Hand', credit: 8000 },
      ],
    },
    {
      id: 's9', date: '2024-06-01', narration: 'Purchased furniture by cheque',
      legs: [
        { account: 'Furniture & Fixtures', debit: 12000 },
        { account: 'Bank A/c', credit: 12000 },
      ],
    },
    {
      id: 's10', date: '2024-06-15', narration: 'Credit sale to Customer Y',
      legs: [
        { account: 'Debtors - Customer Y', debit: 30000 },
        { account: 'Sales', credit: 30000 },
      ],
    },
    {
      id: 's11', date: '2024-07-05', narration: 'Received from Customer X, allowed discount',
      legs: [
        { account: 'Bank A/c', debit: 38000 },
        { account: 'Discount Allowed', debit: 2000 },
        { account: 'Debtors - Customer X', credit: 40000 },
      ],
    },
    {
      id: 's12', date: '2024-07-20', narration: 'Paid to Supplier A, received discount',
      legs: [
        { account: 'Creditors - Supplier A', debit: 25000 },
        { account: 'Bank A/c', credit: 24500 },
        { account: 'Discount Received', credit: 500 },
      ],
    },
    {
      id: 's13', date: '2024-08-10', narration: 'Paid insurance premium by cheque',
      legs: [
        { account: 'Insurance', debit: 2000 },
        { account: 'Bank A/c', credit: 2000 },
      ],
    },
    {
      id: 's14', date: '2024-09-01', narration: 'Cash purchase of goods',
      legs: [
        { account: 'Purchases', debit: 20000 },
        { account: 'Cash in Hand', credit: 20000 },
      ],
    },
    {
      id: 's15', date: '2024-10-15', narration: 'Credit sale to Customer Z',
      legs: [
        { account: 'Debtors - Customer Z', debit: 35000 },
        { account: 'Sales', credit: 35000 },
      ],
    },
    {
      id: 's16', date: '2024-11-01', narration: 'Paid advertisement expenses by cheque',
      legs: [
        { account: 'Advertisement', debit: 3000 },
        { account: 'Bank A/c', credit: 3000 },
      ],
    },
    {
      id: 's17', date: '2024-12-15', narration: 'Owner withdrew cash for personal use',
      legs: [
        { account: 'Drawings', debit: 5000 },
        { account: 'Cash in Hand', credit: 5000 },
      ],
    },
    {
      id: 's18', date: '2025-01-10', narration: 'Paid electricity bill',
      legs: [
        { account: 'Electricity', debit: 1500 },
        { account: 'Cash in Hand', credit: 1500 },
      ],
    },
    {
      id: 's19', date: '2025-02-05', narration: 'Credit purchase from Supplier B',
      legs: [
        { account: 'Purchases', debit: 18000 },
        { account: 'Creditors - Supplier B', credit: 18000 },
      ],
    },
    {
      id: 's20', date: '2025-03-20', narration: 'Cash sale of goods',
      legs: [
        { account: 'Cash in Hand', debit: 22000 },
        { account: 'Sales', credit: 22000 },
      ],
    },
  ],
  adjustments: [
    {
      id: 'sa1', type: 'closing_stock', account: 'Closing Stock',
      amount: 40000, rate: null, narration: 'Closing stock valued at cost at year end',
    },
    {
      id: 'sa2', type: 'depreciation', account: 'Furniture & Fixtures',
      amount: null, rate: 10, narration: 'Depreciation on furniture @ 10% p.a.',
    },
    {
      id: 'sa3', type: 'outstanding', account: 'Salary',
      amount: 2000, rate: null, narration: 'Salary outstanding at year end',
    },
    {
      id: 'sa4', type: 'prepaid', account: 'Insurance',
      amount: 500, rate: null, narration: 'Insurance prepaid at year end',
    },
  ],
}
