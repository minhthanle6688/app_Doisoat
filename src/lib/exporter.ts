import * as XLSX from 'xlsx';
import { MatchedRecord, UnmatchedRecord } from '../types';

export function exportToExcel(matched: MatchedRecord[], unmatched: UnmatchedRecord[]) {
  // Format matched data
  const matchedData = matched.map(m => ({
    'Mã KH': m.customer_code,
    'Tên KH': m.customer_name,
    'Công nợ': m.debt_amount,
    'Đã thanh toán': m.paid_amount,
    'Trạng thái': m.status,
    'Ghi chú': m.note || ''
  }));

  // Format unmatched data
  const unmatchedData = unmatched.map(u => ({
    'Ngày': u.date,
    'Nội dung': u.description,
    'Số tiền': u.amount,
    'Ngân hàng': u.bank
  }));

  const wb = XLSX.utils.book_new();
  
  const wsMatched = XLSX.utils.json_to_sheet(matchedData);
  XLSX.utils.book_append_sheet(wb, wsMatched, 'Matched');
  
  const wsUnmatched = XLSX.utils.json_to_sheet(unmatchedData);
  XLSX.utils.book_append_sheet(wb, wsUnmatched, 'Unmatched');
  
  XLSX.writeFile(wb, 'Ket_qua_doi_soat.xlsx');
}
