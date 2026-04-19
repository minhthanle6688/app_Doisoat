import { DebtRecord, BankRecord, MatchedRecord, UnmatchedRecord, SummaryMetrics } from '../types';
import { normalizeCustomerCode, normalizeAmount, extractCustomerCode, isFuzzyMatch } from './utils';

export function processMatching(rawDebts: any[], rawBanks: any[]) {
  // 1. Normalize Debts
  const debts: DebtRecord[] = rawDebts.map(d => ({
    date: d.date || '',
    customer_code: normalizeCustomerCode(d.customer_code) || '',
    customer_name: d.customer_name || '',
    amount: normalizeAmount(d.amount)
  })).filter(d => d.customer_code); // Must have customer code

  // 2. Normalize Banks & Extract Code
  const banks: BankRecord[] = rawBanks.map(b => {
    const desc = b.description || '';
    let code = normalizeCustomerCode(b.customer_code);
    if (!code) {
      code = extractCustomerCode(desc);
    }
    return {
      date: b.date || '',
      description: desc,
      amount: normalizeAmount(b.amount),
      bank: b.bank || '',
      customer_code: code
    };
  }).filter(b => b.amount > 0 || b.description.trim() !== ''); // Loại bỏ các dòng trống hoàn toàn

  // 3. Build Maps
  // debt_map[customer_code] = total_debt
  const debtMap = new Map<string, { amount: number, name: string }>();
  let total_debt = 0;
  
  for (const debt of debts) {
    const existing = debtMap.get(debt.customer_code) || { amount: 0, name: debt.customer_name };
    debtMap.set(debt.customer_code, {
      amount: existing.amount + debt.amount,
      name: debt.customer_name || existing.name
    });
    total_debt += debt.amount;
  }

  // 4. Match Transactions
  const matchedRecords: MatchedRecord[] = [];
  const unmatchedRecords: UnmatchedRecord[] = [];
  
  const paidMap = new Map<string, number>();
  let total_paid_matched = 0;
  let total_unmatched = 0;

  const notesMap = new Map<string, string>();
  const remainingBanks: BankRecord[] = [];

  // First pass: Match by customer_code
  for (const bank of banks) {
    const code = bank.customer_code;
    if (code && debtMap.has(code)) {
      const currentPaid = paidMap.get(code) || 0;
      paidMap.set(code, currentPaid + bank.amount);
      total_paid_matched += bank.amount;
    } else {
      remainingBanks.push(bank);
    }
  }

  // Second pass: Match remaining banks by exact amount
  const remainingBanks2: BankRecord[] = [];
  for (const bank of remainingBanks) {
    let matchedByAmount = false;
    
    // Find a debt with the exact same amount that hasn't been paid yet
    for (const [code, debtInfo] of debtMap.entries()) {
      const currentPaid = paidMap.get(code) || 0;
      if (currentPaid === 0 && debtInfo.amount === bank.amount) {
        // Match found!
        paidMap.set(code, bank.amount);
        total_paid_matched += bank.amount;
        notesMap.set(code, 'Kiểm tra lại thông tin khách hàng (Khớp theo số tiền)');
        matchedByAmount = true;
        break; // Only match one debt per bank transaction
      }
    }

    if (!matchedByAmount) {
      remainingBanks2.push(bank);
    }
  }

  // Third pass: Match remaining banks by fuzzy name and fuzzy amount
  const fuzzyMatchSet = new Set<string>();
  for (const bank of remainingBanks2) {
    let fuzzyMatched = false;
    for (const [code, debtInfo] of debtMap.entries()) {
      const currentPaid = paidMap.get(code) || 0;
      if (currentPaid === 0 && isFuzzyMatch(bank.description, debtInfo.name, bank.amount, debtInfo.amount)) {
        paidMap.set(code, bank.amount);
        total_paid_matched += bank.amount;
        notesMap.set(code, 'Gần khớp: Kiểm tra lại thông tin (Khớp tương đối theo tên và số tiền)');
        fuzzyMatchSet.add(code);
        fuzzyMatched = true;
        break;
      }
    }

    if (!fuzzyMatched) {
      unmatchedRecords.push({
        date: bank.date,
        description: bank.description,
        amount: bank.amount,
        bank: bank.bank
      });
      total_unmatched += bank.amount;
    }
  }

  // 5. Determine Status for each debt
  for (const [code, debtInfo] of debtMap.entries()) {
    const paid = paidMap.get(code) || 0;
    let status: MatchedRecord['status'] = 'CHƯA THANH TOÁN';
    
    if (fuzzyMatchSet.has(code)) {
      status = 'GẦN KHỚP';
    } else if (paid > 0) {
      if (paid === debtInfo.amount) status = 'KHỚP ĐỦ';
      else if (paid < debtInfo.amount) status = 'THIẾU';
      else if (paid > debtInfo.amount) status = 'DƯ';
    }

    matchedRecords.push({
      customer_code: code,
      customer_name: debtInfo.name,
      debt_amount: debtInfo.amount,
      paid_amount: paid,
      status,
      note: notesMap.get(code)
    });
  }

  // Calculate remaining
  const remaining = total_debt - total_paid_matched;

  const summary: SummaryMetrics = {
    total_debt,
    total_paid: total_paid_matched,
    remaining: remaining > 0 ? remaining : 0, // Remaining debt
    unmatched: total_unmatched
  };

  return {
    matchedRecords,
    unmatchedRecords,
    summary
  };
}
