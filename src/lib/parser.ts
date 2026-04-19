import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { extractCustomerCode, extractCustomerName } from './utils';

const normalizeKeys = (data: any[]) => {
  return data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      // Chuẩn hóa tên cột: xóa khoảng trắng 2 đầu, chuyển chữ thường, thay khoảng trắng giữa bằng _
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      
      let finalKey = normalizedKey;
      
      // Mapping các tên cột tiếng Việt phổ biến sang key chuẩn của hệ thống
      if (['ngày', 'ngay', 'ngày_giao_dịch', 'ngay_giao_dich', 'date', 'time', 'ngày_chứng_từ'].includes(normalizedKey)) finalKey = 'date';
      if (['mã_kh', 'mã_khách_hàng', 'ma_kh', 'ma_khach_hang', 'customer_code', 'mã_đối_tượng', 'mã_khách', 'mã'].includes(normalizedKey)) finalKey = 'customer_code';
      if (['tên_kh', 'tên_khách_hàng', 'ten_kh', 'ten_khach_hang', 'customer_name', 'tên_đối_tượng', 'tên_khách', 'khách_hàng', 'khach_hang', 'tên', 'ten', 'người_mua', 'nguoi_mua'].includes(normalizedKey)) finalKey = 'customer_name';
      if (['số_tiền', 'so_tien', 'amount', 'ghi_có', 'phát_sinh_có', 'sô_tiên', 'tiền', 'số_tiền_ghi_có', 'credit', 'dư_nợ', 'công_nợ', 'phải_thu', 'tổng_nợ', 'số_tiền_thanh_toán', 'tiền_thanh_toán', 'phát_sinh_nợ'].includes(normalizedKey)) finalKey = 'amount';
      if (['nội_dung', 'noi_dung', 'diễn_giải', 'dien_giai', 'description', 'chi_tiết', 'nội_dung_giao_dịch'].includes(normalizedKey)) finalKey = 'description';
      if (['ngân_hàng', 'ngan_hang', 'bank', 'tên_ngân_hàng'].includes(normalizedKey)) finalKey = 'bank';

      newRow[finalKey] = row[key];
    }
    
    // Fallbacks cho trường hợp file bị thiếu cột hoặc upload nhầm file
    if (!newRow.description && newRow.customer_code) {
      newRow.description = `${newRow.customer_code} ${newRow.customer_name || ''}`.trim();
    }
    if (!newRow.customer_code && newRow.description) {
      newRow.customer_code = extractCustomerCode(newRow.description) || '';
    }
    if (!newRow.customer_name && newRow.description) {
      newRow.customer_name = extractCustomerName(newRow.description) || '';
    }
    
    return newRow;
  });
};

// Hàm xử lý file text/csv lộn xộn không có header chuẩn (như file mẫu)
const parseMessyText = (text: string) => {
  const lines = text.split('\n');
  const result = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Tìm ngày (dd/mm/yyyy hh:mm:ss hoặc dd/mm/yyyy)
    const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}(\s\d{2}:\d{2}:\d{2})?/);
    const date = dateMatch ? dateMatch[0] : '';
    
    // Tìm số tiền (nằm ở cuối dòng)
    const amountMatch = line.match(/\s(\d+)$/);
    const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
    
    // Phần còn lại là description
    const description = line;
    
    result.push({
      date,
      description,
      amount,
      customer_code: extractCustomerCode(description) || ''
    });
  }
  return result;
};

// Hàm xử lý mảng dữ liệu lộn xộn từ Excel (khi Excel không có header chuẩn)
const parseMessyExcelArray = (data: any[][]) => {
  const result = [];
  for (const row of data) {
    if (!row || row.length === 0) continue;
    
    // Lấy các ô có dữ liệu
    const validCells = row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    if (validCells.length === 0) continue;

    const line = validCells.map(String).join(' | ');
    
    // Tìm ngày
    const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}(\s\d{2}:\d{2}:\d{2})?/);
    const date = dateMatch ? dateMatch[0] : '';
    
    // Tìm số tiền (quét từ cột cuối lên, bỏ qua ngày tháng và chữ)
    let amount = 0;
    let amountIndex = -1;
    for (let i = validCells.length - 1; i >= 0; i--) {
      const cellStr = String(validCells[i]).trim();
      
      // Bỏ qua nếu là ngày tháng (vd: 01/03/2026 hoặc 1-3-2026)
      if (cellStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) continue;
      
      // Loại bỏ ký hiệu tiền tệ phổ biến
      const withoutCurrency = cellStr.toLowerCase().replace(/(đ|vnd|vnđ|d)\s*$/g, '').trim();
      
      // Nếu sau khi bỏ ký hiệu tiền tệ mà vẫn còn chữ cái -> không phải số tiền (có thể là mã KH, tên)
      if (withoutCurrency.match(/[a-z]/i)) continue;
      
      const cleanAmount = withoutCurrency.replace(/[^\d]/g, '');
      if (cleanAmount) {
        amount = parseInt(cleanAmount, 10);
        amountIndex = i;
        break;
      }
    }

    const customer_code = extractCustomerCode(line) || '';

    // Tìm tên KH bằng cách loại trừ các cột đã biết (ngày, số tiền, mã KH)
    let customer_name = '';
    const potentialNameCells = validCells.filter((cell, i) => {
      if (i === amountIndex) return false;
      const cellStr = String(cell).trim();
      if (date && cellStr.includes(date)) return false;
      if (customer_code && cellStr.includes(customer_code)) return false;
      // Bỏ qua các cột chỉ chứa số (có thể là STT)
      if (cellStr.match(/^\d+$/)) return false;
      return true;
    });
    
    if (potentialNameCells.length > 0) {
      customer_name = potentialNameCells.join(' ').trim();
    }
    
    result.push({
      date,
      description: line,
      amount,
      customer_code,
      customer_name
    });
  }
  return result;
};

export async function parseFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv' || extension === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Kiểm tra xem file có header chuẩn không (chứa dấu phẩy phân cách)
        if (text.includes(',') && text.split('\n')[0].split(',').length > 1) {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(normalizeKeys(results.data)),
            error: (error) => reject(error)
          });
        } else {
          // Xử lý file text lộn xộn
          resolve(parseMessyText(text));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Đọc dưới dạng mảng 2 chiều để kiểm tra cấu trúc
          const rawArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (rawArray.length === 0) {
            resolve([]);
            return;
          }

          // Kiểm tra xem file có header không bằng cách quét 15 dòng đầu tiên
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(15, rawArray.length); i++) {
            if (!rawArray[i]) continue;
            const rowStr = rawArray[i].map(String).join(' ').toLowerCase();
            const hasHeaderKeywords = ['ngày', 'date', 'mã', 'khách', 'customer', 'tiền', 'amount', 'nội dung', 'description', 'dư nợ', 'công nợ', 'phải thu', 'tổng nợ', 'thanh toán'].some(k => rowStr.includes(k));
            if (hasHeaderKeywords) {
              headerRowIndex = i;
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            // Không tìm thấy header -> xử lý như file lộn xộn
            resolve(parseMessyExcelArray(rawArray));
          } else {
            // Có header -> đọc từ dòng header đó
            const json = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });
            resolve(normalizeKeys(json));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Unsupported file format. Please upload CSV, TXT, or Excel files.'));
    }
  });
}
