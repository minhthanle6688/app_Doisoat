export interface DebtRecord {
  date: string;
  customer_code: string;
  customer_name: string;
  amount: number;
}

export interface BankRecord {
  date: string;
  description: string;
  amount: number;
  bank: string;
  customer_code?: string | null;
}

export interface MatchedRecord {
  customer_code: string;
  customer_name: string;
  debt_amount: number;
  paid_amount: number;
  status: 'KHỚP ĐỦ' | 'THIẾU' | 'DƯ' | 'CHƯA THANH TOÁN' | 'GẦN KHỚP';
  note?: string;
}

export interface UnmatchedRecord {
  date: string;
  description: string;
  amount: number;
  bank: string;
}

export interface SummaryMetrics {
  total_debt: number;
  total_paid: number;
  remaining: number;
  unmatched: number;
}
