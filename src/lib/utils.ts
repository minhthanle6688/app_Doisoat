import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function normalizeCustomerCode(code: string | undefined | null): string | null {
  if (!code) return null;
  // Loại bỏ tất cả khoảng trắng, tab, newline, và các ký tự ẩn
  const trimmed = String(code).replace(/[\s\u200B-\u200D\uFEFF]/g, '').toUpperCase();
  // Đảm bảo thay thế chữ O thành số 0 nếu người dùng gõ nhầm ở đoạn PC03HH0
  return trimmed.replace(/PC03HHO/i, 'PC03HH0') || null;
}

export function normalizeAmount(amount: any): number {
  if (typeof amount === 'number') return amount;
  if (!amount) return 0;
  // Xóa dấu phẩy và khoảng trắng
  const cleaned = String(amount).replace(/,/g, '').replace(/\s/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function extractCustomerCode(description: string): string | null {
  if (!description) return null;
  // Tìm mã KH với format PC03HH0 + 6 số (hỗ trợ có khoảng trắng, dấu -, hoặc gõ nhầm chữ O)
  // Regex này tìm chính xác chuỗi bắt đầu bằng PC03HH (có thể có O hoặc 0), theo sau là các ký tự phân cách tùy ý, rồi đến 6 chữ số
  const regex = /PC03HH[0O][\s\-_,]*\d{6}/i;
  const match = String(description).match(regex);
  if (match) {
    // Lấy chuỗi match được, xóa tất cả các ký tự không phải chữ và số, thay O thành 0
    return match[0].replace(/[^a-zA-Z0-9]/g, '').replace(/O/i, '0').toUpperCase();
  }
  return null;
}

export function extractCustomerName(description: string): string | null {
  if (!description) return null;
  // Tìm tên KH nằm giữa 2 dấu # (ví dụ: #Phan Canh Luu#)
  const match = String(description).match(/#([^#]+)#/);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  return null;
}

export function removeVietnameseTones(str: string) {
  if (!str) return "";
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system encode vietnamese combining accent as individual utf-8 characters
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  // Remove extra spaces
  str = str.replace(/ + /g, " ");
  str = str.trim();
  return str.toLowerCase();
}

export function isFuzzyMatch(description: string, name: string, bankAmount: number, debtAmount: number): boolean {
  if (!description || !name) return false;

  // 1. Check amount tolerance (within 5% difference or 50k VND)
  const amountDiff = Math.abs(bankAmount - debtAmount);
  const isAmountClose = amountDiff <= debtAmount * 0.05 || amountDiff <= 50000;

  if (!isAmountClose) return false;

  // 2. Check name similarity
  const normDesc = removeVietnameseTones(description);
  const normName = removeVietnameseTones(name);

  if (normDesc.includes(normName)) return true;

  // Split name into words and check if a significant portion is in the description
  const nameWords = normName.split(/\s+/).filter(w => w.length > 1);
  if (nameWords.length === 0) return false;

  let matchCount = 0;
  for (const word of nameWords) {
    if (normDesc.includes(word)) {
      matchCount++;
    }
  }

  // If more than 60% of the words in the name appear in the description
  return (matchCount / nameWords.length) >= 0.6;
}
