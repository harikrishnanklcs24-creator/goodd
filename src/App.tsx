/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Download, 
  BarChart3, 
  Search, 
  AlertOctagon,
  Info,
  ChevronRight,
  FileSearch,
  Loader2,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';
import { IEEEAnalysisReport } from './types';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const IEEE_THRESHOLDS = {
  SAFE: 15,
  WARNING: 30
};

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<IEEEAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setInputText(fullText);
      } catch (err) {
        setError('Failed to extract text from PDF. Please ensure it is not password protected.');
      }
    } else if (file.type === 'text/plain') {
      const text = await file.text();
      setInputText(text);
    } else {
      setError('Unsupported file type. Please upload a PDF or .txt file.');
    }
  };

  const runAnalysis = async () => {
    if (!inputText.trim()) {
      setError('Please provide paper content to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: inputText })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      setReport(result);
    } catch (err) {
      console.error(err);
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadPDFReport = () => {
    if (!report) return;

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 51, 102);
    doc.text('IEEE Plagiarism Analysis Report', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${timestamp}`, 14, 28);
    doc.text(`File: ${fileName || 'Manual Input'}`, 14, 33);

    // Overall Summary
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('1. Overall Result', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Similarity', `${report.overall.similarity}%`],
        ['AI Usage Percentage', `${report.overall.aiUsagePercentage}%`],
        ['Humanized Content', `${report.overall.humanizedPercentage}%`],
        ['Status', report.overall.status],
        ['IEEE Severity Level', `Level ${report.overall.severityLevel}`],
        ['Severity Title', report.overall.severityTitle],
        ['Recommended Action', report.overall.recommendedAction],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 102] }
    });

    // Section Analysis
    doc.text('2. Section-wise Analysis', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Section', 'Similarity %']],
      body: report.sections.map(s => [s.name, `${s.similarity}%`]),
      theme: 'grid'
    });

    // Flagged Content
    doc.addPage();
    doc.text('3. Flagged Content Details', 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [['Type', 'Explanation', 'Severity']],
      body: report.flaggedContent.map(f => [f.type, f.explanation, f.severity]),
      columnStyles: {
        1: { cellWidth: 100 }
      }
    });

    // Recommendations
    doc.text('4. Recommendations', 14, (doc as any).lastAutoTable.finalY + 15);
    let y = (doc as any).lastAutoTable.finalY + 22;
    report.recommendations.forEach(rec => {
      doc.setFontSize(10);
      doc.text(`• ${rec}`, 14, y);
      y += 7;
    });

    doc.save(`IEEE_Analysis_Report_${fileName || 'Paper'}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Safe': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'Warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'High Risk': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getSeverityColor = (level: number) => {
    if (level <= 1) return 'bg-emerald-500';
    if (level <= 2) return 'bg-blue-500';
    if (level <= 3) return 'bg-amber-500';
    if (level <= 4) return 'bg-orange-500';
    return 'bg-rose-600';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-200">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">IEEE Paper Analyzer</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Plagiarism Detection Engine</p>
            </div>
          </div>
          
          {report && (
            <button 
              onClick={downloadPDFReport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-md"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!report ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                Analyze your research for <span className="text-blue-600">IEEE Compliance</span>
              </h2>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">
                Upload your full IEEE paper (PDF or Text) for deep plagiarism analysis, 
                citation checks, and structural quality evaluation.
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Paper Content</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload PDF
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".pdf,.txt"
                    />
                    {inputText && (
                      <button 
                        onClick={() => { setInputText(''); setFileName(null); }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your IEEE paper text here or upload a PDF..."
                  className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none font-mono text-sm leading-relaxed"
                />

                {fileName && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    {fileName}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={runAnalysis}
                  disabled={isAnalyzing || !inputText.trim()}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200",
                    isAnalyzing || !inputText.trim() 
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Analyzing Paper...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      Run IEEE Analysis
                    </>
                  )}
                </button>
              </div>
              
              <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b sm:border-b-0 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-700">IEEE Standards</p>
                    <p className="text-slate-500">Strict compliance check</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-700">Deep Analysis</p>
                    <p className="text-slate-500">Sentence-level matching</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Download className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-700">PDF Reports</p>
                    <p className="text-slate-500">Professional documentation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-6">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Submission Status Gauge</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">IEEE Acceptance Probability</p>
                </div>
                
                <div className="relative flex flex-col items-center">
                  {/* Semi-circular Gauge */}
                  <div className="relative w-64 h-32 overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 rounded-full border-[20px] border-slate-100" />
                    <div 
                      className={cn(
                        "absolute top-0 left-0 w-64 h-64 rounded-full border-[20px] transition-all duration-1000 ease-out",
                        report.overall.similarity > 30 ? "border-rose-500" :
                        report.overall.similarity > 15 ? "border-amber-500" : "border-emerald-500"
                      )}
                      style={{
                        clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                        transform: `rotate(${Math.min(180, (report.overall.similarity / 60) * 180)}deg)`,
                        transformOrigin: 'center center'
                      }}
                    />
                    {/* Needle */}
                    <div 
                      className="absolute bottom-0 left-1/2 w-1 h-28 bg-slate-800 origin-bottom -translate-x-1/2 transition-all duration-1000 ease-out z-10"
                      style={{
                        transform: `translateX(-50%) rotate(${Math.min(90, Math.max(-90, (report.overall.similarity / 30 * 90) - 90))}deg)`
                      }}
                    />
                    <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-slate-800 rounded-full -translate-x-1/2 translate-y-1/2 z-20" />
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className={cn(
                      "text-3xl font-black tracking-tighter uppercase",
                      report.overall.similarity > 30 ? "text-rose-600" :
                      report.overall.similarity > 15 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {report.overall.similarity > 30 ? "Rejected" :
                       report.overall.similarity > 15 ? "Revision Required" : "Accepted"}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      Official IEEE Decision Estimate
                    </p>
                  </div>
                </div>

                <div className="w-full grid grid-cols-3 gap-2 pt-6 border-t border-slate-100">
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-emerald-500 rounded-full" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Accepted</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-amber-500 rounded-full" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Revision</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-rose-500 rounded-full" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Rejected</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-6">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Similarity Gauge</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Total Matched Content</p>
                </div>
                
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-slate-100"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * report.overall.similarity) / 100}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-1000 ease-out",
                        report.overall.similarity > 30 ? "text-rose-500" :
                        report.overall.similarity > 15 ? "text-amber-500" : "text-emerald-500"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-900 leading-none">{report.overall.similarity}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Similarity</span>
                  </div>
                </div>

                <div className={cn(
                  "w-full px-4 py-3 rounded-2xl text-sm font-bold border shadow-sm flex items-center justify-center gap-2",
                  getStatusColor(report.overall.status)
                )}>
                  {report.overall.similarity > 30 ? <XCircle className="w-4 h-4" /> :
                   report.overall.similarity > 15 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {report.overall.status.toUpperCase()}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-6">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">AI & Human Content</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Usage Analysis</p>
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle
                          cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                          strokeDasharray={251}
                          strokeDashoffset={251 - (251 * report.overall.aiUsagePercentage) / 100}
                          strokeLinecap="round"
                          className="text-blue-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-black text-slate-900 text-sm">
                        {report.overall.aiUsagePercentage}%
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">AI Usage</span>
                  </div>

                  <div className="flex flex-col items-center space-y-2">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle
                          cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                          strokeDasharray={251}
                          strokeDashoffset={251 - (251 * report.overall.humanizedPercentage) / 100}
                          strokeLinecap="round"
                          className="text-emerald-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-black text-slate-900 text-sm">
                        {report.overall.humanizedPercentage}%
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Humanized</span>
                  </div>
                </div>

                <div className="w-full pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 italic">
                    {report.overall.aiUsagePercentage > 20 
                      ? "Significant AI usage detected." 
                      : "Content appears primarily human-authored."}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6 bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">IEEE Severity Assessment</h3>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                      {(report.overall as any).severityTitle || 'Analysis'} Level
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500">Level {report.overall.severityLevel}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((l) => (
                        <div 
                          key={l}
                          className={cn(
                            "w-8 h-2 rounded-full transition-all duration-500",
                            l <= report.overall.severityLevel ? getSeverityColor(report.overall.severityLevel) : "bg-slate-100"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <p className="text-slate-600 leading-relaxed italic">
                  "{report.overall.severityExplanation}"
                </p>

                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4">
                  <div className="p-2 bg-rose-500 rounded-lg text-white">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Recommended IEEE Action</p>
                    <p className="text-sm font-bold text-slate-800">{report.overall.recommendedAction}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-widest">
                      <Info className="w-4 h-4 text-blue-500" />
                      Compliance Insights
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-50 rounded-xl text-sm">
                        <span className="font-bold text-slate-700">Section Most Affected:</span> {report.insights.mostPlagiarizedSection}
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-sm">
                        <span className="font-bold text-slate-700">IEEE Acceptance Risk:</span> {report.insights.acceptanceRisk}
                      </div>
                      {report.insights.selfPlagiarismNote && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                          <span className="font-bold">Self-Plagiarism Check:</span> {report.insights.selfPlagiarismNote}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-widest">
                      <Info className="w-4 h-4 text-blue-500" />
                      Similarity Range Guide
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-emerald-800">0% – 15%</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Safe / Acceptable</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-amber-800">15% – 30%</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Warning / Revision</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-xs font-bold text-rose-800">&gt; 30%</span>
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 uppercase">High Risk / Rejection</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-widest">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      Section Breakdown
                    </div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.sections} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" hide />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="similarity" radius={[6, 6, 0, 0]} barSize={32}>
                            {report.sections.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.similarity > 30 ? '#F43F5E' : entry.similarity > 15 ? '#F59E0B' : '#10B981'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Flagged Content (IEEE Standards)
                    </h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {report.flaggedContent.length} Issues Detected
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {report.flaggedContent.map((item, idx) => (
                      <div key={idx} className="p-6 hover:bg-slate-50 transition-colors space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter",
                            item.type === 'Direct Copying' ? "bg-rose-100 text-rose-700" :
                            item.type === 'Poor Paraphrasing' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {item.type}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded border",
                            item.severity === 'High' ? "border-rose-200 text-rose-600 bg-rose-50" :
                            item.severity === 'Medium' ? "border-amber-200 text-amber-600 bg-amber-50" : "border-emerald-200 text-emerald-600 bg-emerald-50"
                          )}>
                            {item.severity} Severity
                          </span>
                        </div>
                        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs leading-relaxed border-l-4 border-blue-500">
                          "{item.text}"
                        </div>
                        <p className="text-sm text-slate-600 flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          {item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    IEEE Compliance Recommendations
                  </h3>
                  <div className="space-y-4">
                    {report.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800 space-y-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                    Top Matched Sources
                  </h3>
                  <div className="space-y-3">
                    {report.sources.map((source, idx) => (
                      <div key={idx} className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-400 truncate max-w-[150px]">{source.name}</span>
                            {source.similarity > 10 && (
                              <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Critical Flag (&gt;10%)</span>
                            )}
                          </div>
                          <span className="text-sm font-black text-white">{source.similarity}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              source.similarity > 10 ? "bg-rose-500" : "bg-blue-500"
                            )}
                            style={{ width: `${source.similarity}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => { setReport(null); setInputText(''); setFileName(null); }}
                  className="w-full py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  Analyze Another Paper
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <FileSearch className="w-5 h-5" />
            <span className="text-sm font-bold tracking-tighter">IEEE ANALYZER v2.0</span>
          </div>
          <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">IEEE Standards</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Plagiarism Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Ethics in Publishing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
