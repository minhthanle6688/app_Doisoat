/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Calculator, BarChart3, TableProperties } from 'lucide-react';
import { parseFile } from './lib/parser';
import { processMatching } from './lib/matcher';
import { exportToExcel } from './lib/exporter';
import { MatchedRecord, UnmatchedRecord, SummaryMetrics } from './types';
import { formatCurrency, cn, normalizeAmount } from './lib/utils';

export default function App() {
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [debtFile, setDebtFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  
  const [rawDebts, setRawDebts] = useState<any[] | null>(null);
  const [rawBanks, setRawBanks] = useState<any[] | null>(null);
  const [isParsingDebt, setIsParsingDebt] = useState(false);
  const [isParsingBank, setIsParsingBank] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [matched, setMatched] = useState<MatchedRecord[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedRecord[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);

  const handleDebtFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setDebtFile(file || null);
    setRawDebts(null);
    setMatched([]); setUnmatched([]); setSummary(null);
    setError(null);
    
    if (file) {
      setIsParsingDebt(true);
      try {
        const data = await parseFile(file);
        setRawDebts(data);
      } catch (err: any) {
        setError(`Lỗi đọc file công nợ: ${err.message}`);
      } finally {
        setIsParsingDebt(false);
      }
    }
  };

  const handleBankFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setBankFile(file || null);
    setRawBanks(null);
    setMatched([]); setUnmatched([]); setSummary(null);
    setError(null);
    
    if (file) {
      setIsParsingBank(true);
      try {
        const data = await parseFile(file);
        setRawBanks(data);
      } catch (err: any) {
        setError(`Lỗi đọc file ngân hàng: ${err.message}`);
      } finally {
        setIsParsingBank(false);
      }
    }
  };

  const handleProcess = () => {
    if (!rawDebts || !rawBanks) {
      setError('Vui lòng tải lên và chờ xử lý xong cả 2 file.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = processMatching(rawDebts, rawBanks);
      
      setMatched(result.matchedRecords);
      setUnmatched(result.unmatchedRecords);
      setSummary(result.summary);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đối soát.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (matched.length > 0 || unmatched.length > 0) {
      exportToExcel(matched, unmatched);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Hệ thống Đối soát Công nợ - Kế toán</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Configuration Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            Cấu hình đối soát
          </h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Chế độ hoạt động</label>
            <div className="flex gap-4">
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                mode === 'single' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50"
              )}>
                <input 
                  type="radio" 
                  name="mode" 
                  value="single" 
                  checked={mode === 'single'} 
                  onChange={() => setMode('single')}
                  className="hidden"
                />
                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", mode === 'single' ? "border-blue-500" : "border-gray-300")}>
                  {mode === 'single' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <span>Theo từng ngân hàng</span>
              </label>
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                mode === 'all' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50"
              )}>
                <input 
                  type="radio" 
                  name="mode" 
                  value="all" 
                  checked={mode === 'all'} 
                  onChange={() => setMode('all')}
                  className="hidden"
                />
                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", mode === 'all' ? "border-blue-500" : "border-gray-300")}>
                  {mode === 'all' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <span>Tổng tất cả ngân hàng</span>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Debt File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File Công nợ (Internal)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors bg-gray-50">
                <div className="space-y-1 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-1">
                      <span>Tải file lên</span>
                      <input type="file" className="sr-only" accept=".csv, .xlsx, .xls, .txt" onChange={handleDebtFileChange} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">CSV, XLSX, TXT lên đến 10MB</p>
                  {debtFile && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-green-600 truncate max-w-[200px] mx-auto" title={debtFile.name}>{debtFile.name}</p>
                      {isParsingDebt ? (
                        <p className="text-xs text-blue-500 mt-1 animate-pulse">Đang đọc dữ liệu...</p>
                      ) : rawDebts ? (
                        <p className="text-sm font-bold text-blue-700 mt-1 bg-blue-50 py-1 px-2 rounded-md inline-block">
                          Đã tải: {rawDebts.length} dòng
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bank File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File Ngân hàng (Kế toán)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors bg-gray-50">
                <div className="space-y-1 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-1">
                      <span>Tải file lên</span>
                      <input type="file" className="sr-only" accept=".csv, .xlsx, .xls, .txt" onChange={handleBankFileChange} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">CSV, XLSX, TXT lên đến 10MB</p>
                  {bankFile && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-green-600 truncate max-w-[200px] mx-auto" title={bankFile.name}>{bankFile.name}</p>
                      {isParsingBank ? (
                        <p className="text-xs text-blue-500 mt-1 animate-pulse">Đang đọc dữ liệu...</p>
                      ) : rawBanks ? (
                        <p className="text-sm font-bold text-blue-700 mt-1 bg-blue-50 py-1 px-2 rounded-md inline-block">
                          Đã tải: {rawBanks.length} dòng
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleProcess}
              disabled={isProcessing || !rawDebts || !rawBanks || isParsingDebt || isParsingBank}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Bắt đầu đối soát
                </>
              )}
            </button>
          </div>
        </section>

        {/* Raw Data Preview Section */}
        {(rawDebts || rawBanks) && (
          <section className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-lg font-medium flex items-center gap-2 text-gray-900">
              <TableProperties className="w-5 h-5 text-gray-500" />
              Dữ liệu đã tải
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Raw Debts Table */}
              {rawDebts ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-900">Công nợ ({rawDebts.length} dòng)</h3>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mã KH</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tên KH</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rawDebts.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.date || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{row.customer_code || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]" title={row.customer_name}>{row.customer_name || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(normalizeAmount(row.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rawDebts.length > 50 && (
                      <div className="p-2 text-center text-xs text-gray-500 border-t bg-gray-50">
                        Hiển thị 50 dòng đầu tiên
                      </div>
                    )}
                  </div>
                </div>
              ) : <div />}

              {/* Raw Banks Table */}
              {rawBanks ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[400px]">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-900">Ngân hàng ({rawBanks.length} dòng)</h3>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nội dung</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rawBanks.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.date || '-'}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 max-w-[200px] truncate" title={row.description}>{row.description || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(normalizeAmount(row.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rawBanks.length > 50 && (
                      <div className="p-2 text-center text-xs text-gray-500 border-t bg-gray-50">
                        Hiển thị 50 dòng đầu tiên
                      </div>
                    )}
                  </div>
                </div>
              ) : <div />}
            </div>
          </section>
        )}

        {/* Results Section */}
        {summary && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">Tổng công nợ</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_debt)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">Đã thanh toán (Khớp)</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_paid)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">Còn lại (Chưa thanh toán)</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.remaining)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">Giao dịch không xác định</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.unmatched)}</p>
              </div>
            </section>

            {/* Actions */}
            <div className="flex justify-end">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
            </div>

            {/* Tables */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Matched Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">Kết quả đối soát ({matched.length})</h3>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã KH</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên KH</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Công nợ</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Đã trả</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {matched.slice(0, 100).map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.customer_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate" title={m.customer_name}>{m.customer_name || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(m.debt_amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(m.paid_amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-medium",
                              m.status === 'KHỚP ĐỦ' && "bg-green-100 text-green-800",
                              m.status === 'GẦN KHỚP' && "bg-purple-100 text-purple-800",
                              m.status === 'THIẾU' && "bg-yellow-100 text-yellow-800",
                              m.status === 'DƯ' && "bg-blue-100 text-blue-800",
                              m.status === 'CHƯA THANH TOÁN' && "bg-red-100 text-red-800"
                            )}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-orange-600 italic max-w-[200px] truncate" title={m.note}>{m.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {matched.length > 100 && (
                    <div className="p-4 text-center text-sm text-gray-500 border-t">
                      Hiển thị 100 dòng đầu tiên. Vui lòng xuất Excel để xem toàn bộ.
                    </div>
                  )}
                </div>
              </div>

              {/* Unmatched Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">Giao dịch không xác định ({unmatched.length})</h3>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {unmatched.slice(0, 100).map((u, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.date}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={u.description}>{u.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatCurrency(u.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {unmatched.length > 100 && (
                    <div className="p-4 text-center text-sm text-gray-500 border-t">
                      Hiển thị 100 dòng đầu tiên. Vui lòng xuất Excel để xem toàn bộ.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

