import pandas as pd
import re
import logging
import argparse
import sys

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def extract_customer_code(description):
    """
    Trích xuất mã khách hàng từ chuỗi nội dung (description).
    Regex: PC03HH0 theo sau là 6 chữ số.
    """
    if pd.isna(description):
        return None
    
    # Tìm chuỗi PC03HH0 + 6 số (không phân biệt hoa thường)
    match = re.search(r'PC03HH0\d{6}', str(description), re.IGNORECASE)
    if match:
        return match.group(0).upper()
    return None

def normalize_data(df, data_type):
    """
    Chuẩn hóa dữ liệu:
    - Text: trim, uppercase, remove extra spaces.
    - Amount: remove dấu phẩy, convert sang int.
    """
    df_norm = df.copy()
    
    # 1. Chuẩn hóa tất cả các cột text (string)
    for col in df_norm.select_dtypes(include=['object']).columns:
        # Chuyển thành string, xóa khoảng trắng 2 đầu, in hoa, và thay thế nhiều khoảng trắng bằng 1 khoảng trắng
        df_norm[col] = df_norm[col].astype(str).str.strip().str.upper().str.replace(r'\s+', ' ', regex=True)
        # Xử lý các giá trị NaN bị biến thành chuỗi 'NAN'
        df_norm[col] = df_norm[col].replace('NAN', None)

    # 2. Chuẩn hóa cột amount
    if 'amount' in df_norm.columns:
        # Xóa tất cả các ký tự không phải là số (bao gồm dấu phẩy, dấu chấm, khoảng trắng)
        df_norm['amount'] = df_norm['amount'].astype(str).str.replace(r'[^\d]', '', regex=True)
        # Convert sang int, nếu lỗi thì gán là 0
        df_norm['amount'] = pd.to_numeric(df_norm['amount'], errors='coerce').fillna(0).astype(int)

    # 3. Trích xuất customer_code cho bank_data nếu thiếu
    if data_type == 'bank':
        if 'customer_code' not in df_norm.columns:
            df_norm['customer_code'] = None
            
        # Tìm các dòng không có customer_code
        mask = df_norm['customer_code'].isna() | (df_norm['customer_code'] == '') | (df_norm['customer_code'] == 'NONE')
        
        if 'description' in df_norm.columns:
            # Apply hàm extract_customer_code cho các dòng bị thiếu
            df_norm.loc[mask, 'customer_code'] = df_norm.loc[mask, 'description'].apply(extract_customer_code)

    return df_norm

def load_data(file_path):
    """
    Load dữ liệu từ file Excel gồm 2 sheet: bank_data và debt_data.
    """
    try:
        logging.info(f"Đang tải dữ liệu từ file: {file_path}")
        bank_df = pd.read_excel(file_path, sheet_name='bank_data')
        debt_df = pd.read_excel(file_path, sheet_name='debt_data')
        logging.info(f"Tải thành công: {len(bank_df)} dòng bank, {len(debt_df)} dòng debt.")
        return bank_df, debt_df
    except ValueError as ve:
        logging.error(f"Lỗi cấu trúc file Excel (thiếu sheet): {ve}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Lỗi khi đọc file: {e}")
        sys.exit(1)

def build_debt_map(debt_df):
    """
    Build dictionary để map customer_code với danh sách các khoản nợ.
    Format: { 'PC03HH0123456': [ {'index': 0, 'amount': 1000}, ... ] }
    """
    debt_map = {}
    for idx, row in debt_df.iterrows():
        code = row.get('customer_code')
        if pd.isna(code) or not code:
            continue
            
        if code not in debt_map:
            debt_map[code] = []
            
        debt_map[code].append({
            'index': idx, 
            'amount': row['amount']
        })
    return debt_map

def match_transaction(bank_row, debt_map, matched_debts):
    """
    Thực hiện logic matching cho 1 transaction.
    Trả về: (status, matched_debt_index)
    """
    code = bank_row.get('customer_code')
    amount = bank_row.get('amount', 0)

    # IF không có customer_code -> UNMATCHED
    if pd.isna(code) or not code:
        return "UNMATCHED", None

    # IF customer_code không tồn tại trong debt_map -> UNMATCHED
    if code not in debt_map:
        return "UNMATCHED", None

    debt_list = debt_map[code]

    # Ưu tiên 1: Tìm EXACT match trước
    for debt in debt_list:
        if debt['index'] in matched_debts:
            continue # Bỏ qua debt đã được match
        if amount == debt['amount']:
            return "EXACT", debt['index']

    # Ưu tiên 2: Nếu không có EXACT, tìm PARTIAL hoặc OVERPAID
    for debt in debt_list:
        if debt['index'] in matched_debts:
            continue
        if amount < debt['amount']:
            return "PARTIAL", debt['index']
        elif amount > debt['amount']:
            return "OVERPAID", debt['index']

    # Nếu tất cả debt của KH này đều đã được match hết
    return "UNMATCHED", None

def reconcile(bank_df, debt_df):
    """
    Hàm chính thực hiện đối soát toàn bộ dữ liệu.
    Độ phức tạp: O(n + m)
    """
    logging.info("Bắt đầu quá trình đối soát (Matching)...")
    
    # Bước 3: Build map
    debt_map = build_debt_map(debt_df)
    
    # Set lưu trữ các index của debt đã được match (Mỗi debt chỉ match 1 lần)
    matched_debts = set()

    results = []
    unmatched_bank = []

    # Bước 4: Matching (Duyệt qua bank_df - O(n))
    for idx, bank_row in bank_df.iterrows():
        status, debt_idx = match_transaction(bank_row, debt_map, matched_debts)

        if status == "UNMATCHED":
            unmatched_bank.append(bank_row.to_dict())
        else:
            # Đánh dấu debt này đã được match
            matched_debts.add(debt_idx)
            debt_info = debt_df.loc[debt_idx]
            
            results.append({
                'bank_date': bank_row.get('date'),
                'bank_description': bank_row.get('description'),
                'customer_code': code,
                'customer_name': debt_info.get('customer_name'),
                'debt_amount': debt_info.get('amount'),
                'bank_amount': bank_row.get('amount'),
                'status': status
            })

    # Tạo DataFrame cho kết quả
    matched_df = pd.DataFrame(results)
    unmatched_bank_df = pd.DataFrame(unmatched_bank)

    # Tìm các debt chưa được match (O(m))
    unmatched_debt_indices = set(debt_df.index) - matched_debts
    unmatched_debt_df = debt_df.loc[list(unmatched_debt_indices)]

    logging.info(f"Đối soát hoàn tất. Khớp: {len(matched_df)}, Bank không xác định: {len(unmatched_bank_df)}, Công nợ tồn: {len(unmatched_debt_df)}")
    
    return matched_df, unmatched_bank_df, unmatched_debt_df

def summarize(debt_df, matched_df):
    """
    Tính toán các chỉ số tổng quan.
    """
    total_debt = debt_df['amount'].sum() if not debt_df.empty else 0
    total_paid = matched_df['bank_amount'].sum() if not matched_df.empty else 0
    remaining = total_debt - total_paid

    summary_data = {
        'Metric': ['Total Debt (Tổng nợ)', 'Total Paid (Đã thanh toán)', 'Remaining (Còn lại)'],
        'Amount': [total_debt, total_paid, remaining]
    }
    return pd.DataFrame(summary_data)

def export_excel(matched_df, unmatched_bank_df, unmatched_debt_df, summary_df):
    """
    Xuất kết quả ra 4 file Excel.
    """
    try:
        logging.info("Đang xuất kết quả ra các file Excel...")
        matched_df.to_excel('matched.xlsx', index=False)
        unmatched_bank_df.to_excel('unmatched_bank.xlsx', index=False)
        unmatched_debt_df.to_excel('unmatched_debt.xlsx', index=False)
        summary_df.to_excel('summary.xlsx', index=False)
        logging.info("Xuất file thành công! Kiểm tra thư mục hiện tại.")
    except Exception as e:
        logging.error(f"Lỗi khi xuất file Excel: {e}")

def main():
    """
    Hàm main chạy chương trình qua CLI.
    """
    parser = argparse.ArgumentParser(description="Hệ thống đối soát Công nợ và Ngân hàng")
    parser.add_argument("input_file", help="Đường dẫn đến file Excel đầu vào (chứa 2 sheet: bank_data và debt_data)")
    args = parser.parse_args()

    # Bước 1: Load dữ liệu
    raw_bank_df, raw_debt_df = load_data(args.input_file)

    # Bước 2: Normalize toàn bộ dữ liệu
    logging.info("Đang chuẩn hóa dữ liệu...")
    bank_df = normalize_data(raw_bank_df, 'bank')
    debt_df = normalize_data(raw_debt_df, 'debt')

    # Bước 3 & 4: Build Map và Matching
    matched_df, unmatched_bank_df, unmatched_debt_df = reconcile(bank_df, debt_df)

    # Tính toán Summary
    summary_df = summarize(debt_df, matched_df)

    # Bước 5: Xuất Output
    export_excel(matched_df, unmatched_bank_df, unmatched_debt_df, summary_df)

if __name__ == "__main__":
    main()
