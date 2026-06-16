import React, { useState, useMemo, useEffect } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  Upload, 
  FileText, 
  Database, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Search, 
  ArrowUpDown, 
  Download, 
  Sparkles, 
  RefreshCw, 
  Dna, 
  BarChart2, 
  TrendingUp, 
  X, 
  ShieldAlert, 
  Check, 
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileDown,
  Filter,
  Sliders,
  Sun,
  Moon
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from 'recharts';

import { 
  parseFasta, 
  filterFastaText,
  generateSyntheticAssembly, 
  performTaxonomicScan, 
  AssemblyMetrics, 
  Contig, 
  TaxonScanResult,
  TAXON_REFERENCES
} from './bioUtils';

// Helper to format base counts into human-readable units
function formatBp(bases: number): string {
  if (bases >= 1_000_000) {
    return (bases / 1_000_000).toFixed(2) + " Mb";
  }
  if (bases >= 1_000) {
    return (bases / 1_000).toFixed(1) + " Kb";
  }
  return bases.toLocaleString() + " bp";
}

// Polished bin formatter for slanted axis labels (prevents dense decimals)
function formatBinBp(bases: number): string {
  if (bases >= 1_000_000) {
    const mbVal = bases / 1_000_000;
    return (mbVal % 1 === 0 ? mbVal.toString() : mbVal.toFixed(2)) + " Mb";
  }
  if (bases >= 1_000) {
    return Math.round(bases / 1_000) + " Kb";
  }
  return bases.toLocaleString() + " bp";
}

export default function App() {
  // Store the active FASTA contents (raw string) and the parsed metrics
  const [fastaText, setFastaText] = useState<string>(() => 
    generateSyntheticAssembly('ecoli_isolate')
  );
  
  const [activePreset, setActivePreset] = useState<'ecoli' | 'salmonella' | 'pseudomonas' | 'custom'>('ecoli');
  const [fileName, setFileName] = useState<string>("ecoli_k12_isolate_assembly.fasta");
  const [fileSize, setFileSize] = useState<number>(4580120); // mock size for preset
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tablePage, setTablePage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [selectedContigId, setSelectedContigId] = useState<string | null>(null);
  
  // Sorting for contigs table
  const [sortField, setSortField] = useState<'id' | 'length' | 'gcContent'>('length');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Chart options
  const [logScaleY, setLogScaleY] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'taxonomy' | 'explorer' | 'about'>('dashboard');

  // Active appearance / theme switcher state (dark default, switchable to light)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const isDark = theme === 'dark';

  // Dynamic Chart styling configurations
  const gridStroke = isDark ? "#1f2937" : "#cbd5e1";
  const axisStroke = isDark ? "#6b7280" : "#475569";
  const tooltipContentStyle = isDark 
    ? { backgroundColor: '#0f172a', borderColor: '#1f2937', borderRadius: '12px', fontSize: '11px', color: '#fff' }
    : { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', fontSize: '11px', color: '#1e293b' };
  const barEvenFill = isDark ? "#14B8A6" : "#0D9488";
  const barOddFill = isDark ? "#10B981" : "#2563EB";

  // Async fasta parser hooks
  const [metrics, setMetrics] = useState<AssemblyMetrics | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingProgress, setParsingProgress] = useState<string>("Initializing...");

  // Bio-filtration thresholds download states
  const [filterThreshold, setFilterThreshold] = useState<number>(1000);
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);

  // Compute metrics asynchronously to maintain pristine frame responsive rendering
  useEffect(() => {
    setIsParsing(true);
    setParsingProgress("Extracting IUPAC bases and counting nucleotides...");
    const timer = setTimeout(() => {
      try {
        const parsed = parseFasta(fastaText);
        setErrorMessage(null);
        setMetrics(parsed);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to parse FASTA file. Please check format.");
        setMetrics(null);
      } finally {
        setIsParsing(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [fastaText]);

  // Live filter previews
  const filterPreview = useMemo(() => {
    if (!metrics) return { kept: 0, removed: 0 };
    let kept = 0;
    let removed = 0;
    for (const c of metrics.contigs) {
      if (c.length >= filterThreshold) kept++;
      else removed++;
    }
    return { kept, removed };
  }, [metrics, filterThreshold]);

  // Compute taxonomic scans
  const taxonomicResults = useMemo<TaxonScanResult[]>(() => {
    if (!metrics) return [];
    return performTaxonomicScan(metrics);
  }, [metrics]);

  // Compute dynamic GC thresholds relative to weighted assembly mean GC content
  const gcStats = useMemo(() => {
    if (!metrics || metrics.contigs.length === 0) {
      return { mean: 50, stdDev: 5, lowThreshold: 40, highThreshold: 60 };
    }
    const mean = metrics.gcContent;
    const lengths = metrics.contigs.map(c => c.length);
    const totalW = lengths.reduce((sum, l) => sum + l, 0);
    
    // Length-weighted standard deviation gives a much cleaner biological baseline
    const weightedVariance = metrics.contigs.reduce((sum, c) => sum + c.length * Math.pow(c.gcContent - mean, 2), 0) / totalW;
    let stdDev = Math.sqrt(weightedVariance);
    if (stdDev < 1.0) stdDev = 2.0; // clamp to prevent tight bounds on clean assemblies
    
    return {
      mean,
      stdDev,
      lowThreshold: mean - 2 * stdDev,
      highThreshold: mean + 2 * stdDev
    };
  }, [metrics]);

  // Load preset assemblies procedurally
  const handleLoadPreset = (type: 'ecoli_isolate' | 'salmonella_fragmented' | 'polluted_pseudomonas') => {
    let name = "";
    let mockSize = 0;
    if (type === 'ecoli_isolate') {
      name = "ecoli_k12_isolate_assembly.fasta";
      mockSize = 4580120;
      setActivePreset('ecoli');
    } else if (type === 'salmonella_fragmented') {
      name = "salmonella_enterica_fragmented_run.fna";
      mockSize = 4812300;
      setActivePreset('salmonella');
    } else {
      name = "clinical_pseudomonas_host_polluted.fasta";
      mockSize = 6542100;
      setActivePreset('pseudomonas');
    }
    
    const synthetic = generateSyntheticAssembly(type);
    setFastaText(synthetic);
    setFileName(name);
    setFileSize(mockSize);
    setSelectedContigId(null);
    setTablePage(0);
  };

  // Handle uploaded FASTA file
  const handleFastaFile = (file: File) => {
    if (!file) return;
    
    // Accept up to 100MB warning condition
    if (file.size > 100 * 1024 * 1024) {
      alert("File exceeds recommended 100MB threshold. Parsing might throttle client browser resources.");
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setFastaText(text);
        setFileName(file.name);
        setFileSize(file.size);
        setActivePreset('custom');
        setSelectedContigId(null);
        setTablePage(0);
      }
    };
    reader.readAsText(file);
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFastaFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFastaFile(e.target.files[0]);
    }
  };

  // Sort and filter contigs
  const filteredContigs = useMemo(() => {
    if (!metrics) return [];
    
    let list = [...metrics.contigs];
    
    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.id.toLowerCase().includes(q) || c.header.toLowerCase().includes(q));
    }
    
    // Sort logic
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    
    return list;
  }, [metrics, searchQuery, sortField, sortAsc]);

  // Paginated contigs for table
  const paginatedContigs = useMemo(() => {
    const start = tablePage * rowsPerPage;
    return filteredContigs.slice(start, start + rowsPerPage);
  }, [filteredContigs, tablePage, rowsPerPage]);

  // Handle selected contig details
  const selectedContig = useMemo<Contig | null>(() => {
    if (!metrics || !selectedContigId) return null;
    return metrics.contigs.find(c => c.id === selectedContigId) || null;
  }, [metrics, selectedContigId]);

  // Visual chart datasets
  const lengthDistData = useMemo(() => {
    if (!metrics) return [];
    
    // Bin contigs into size thresholds to create elegant dynamic charts
    // Logarithmic range partitioning provides perfect visual density
    const binsCount = 20;
    const contigLengths = metrics.contigs.map(c => c.length);
    const minL = Math.min(...contigLengths);
    const maxL = Math.max(...contigLengths);
    
    // We will do a base-10 log-spacing or linear-spacing based on user flag
    const dataBins = Array.from({ length: binsCount }, (_, i) => {
      let binMin = 0;
      let binMax = 0;
      
      if (logScaleY && minL > 0) {
        const logMin = Math.log10(minL);
        const logMax = Math.log10(maxL);
        const step = (logMax - logMin) / binsCount;
        binMin = Math.pow(10, logMin + i * step);
        binMax = Math.pow(10, logMin + (i + 1) * step);
      } else {
        const step = (maxL - minL) / binsCount;
        binMin = minL + i * step;
        binMax = minL + (i + 1) * step;
      }
      
      return {
        index: i,
        rangeLabel: `${formatBinBp(Math.round(binMin))} - ${formatBinBp(Math.round(binMax))}`,
        binMin,
        binMax,
        count: 0,
        volume: 0,
        avgGC: 0,
        gcSum: 0
      };
    });
    
    for (const c of metrics.contigs) {
      let putInBin = binsCount - 1;
      for (let i = 0; i < binsCount; i++) {
        if (c.length >= dataBins[i].binMin && c.length <= dataBins[i].binMax) {
          putInBin = i;
          break;
        }
      }
      dataBins[putInBin].count++;
      dataBins[putInBin].volume += c.length;
      dataBins[putInBin].gcSum += (c.gcContent * c.length);
    }
    
    return dataBins.map(b => ({
      ...b,
      avgGC: b.volume > 0 ? parseFloat((b.gcSum / b.volume).toFixed(1)) : 0,
      formattedVolume: (b.volume / 1000).toFixed(1) + " Kb"
    })).filter(b => b.count > 0);
  }, [metrics, logScaleY]);

  // Curve trace for cumulative assembly
  const cumulativeData = useMemo(() => {
    if (!metrics) return [];
    
    let cumSum = 0;
    const total = metrics.totalLength;
    
    // Map of contigs sorted descending already
    // Sample down if there are thousands of contigs to guarantee superb chart rendering speeds.
    const rawList = metrics.contigs;
    const maxDataPoints = 150;
    const step = Math.max(1, Math.floor(rawList.length / maxDataPoints));
    
    const chartPoints = [];
    
    let accumLength = 0;
    for (let i = 0; i < rawList.length; i++) {
      accumLength += rawList[i].length;
      // sampling or final point
      if (i % step === 0 || i === rawList.length - 1) {
        chartPoints.push({
          contigCount: i + 1,
          contigName: rawList[i].id,
          contigLength: rawList[i].length,
          cumulativeSum: accumLength,
          cumulativePercent: parseFloat(((accumLength / total) * 100).toFixed(1)),
          n50Line: total * 0.5
        });
      }
    }
    
    return chartPoints;
  }, [metrics]);

  // GC vs Length scatter plot dataset
  const scatterData = useMemo(() => {
    if (!metrics) return [];
    
    // Sample down to maximum 300 contigs for fast visual execution
    const sorted = [...metrics.contigs].sort((a,b) => b.length - a.length);
    const subset = sorted.slice(0, 300);
    
    return subset.map((c, i) => ({
      id: c.id,
      length: c.length,
      lengthKb: parseFloat((c.length / 1000).toFixed(1)),
      gcContent: parseFloat(c.gcContent.toFixed(1)),
      rank: i + 1
    }));
  }, [metrics]);

  // Fast statistics for overall nucleotides
  const totalBases = metrics ? (metrics.nucleotideCounts.a + metrics.nucleotideCounts.c + metrics.nucleotideCounts.g + metrics.nucleotideCounts.t) : 0;
  
  // Download CSV of contigs list
  const downloadContigsCsv = () => {
    if (!metrics) return;
    const headers = "Contig ID,Header,Length (bp),GC Content (%)\n";
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers 
      + metrics.contigs.map(c => `"${c.id}","${c.header.replace(/"/g, '""')}",${c.length},${c.gcContent.toFixed(2)}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contigvision_metrics_${fileName.replace(/\.[^/.]+$/, "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download active fasta 
  const downloadActiveFasta = () => {
    const element = document.createElement("a");
    const fileObj = new Blob([fastaText], {type: 'text/plain'});
    element.href = URL.createObjectURL(fileObj);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div 
      id="contigvision-root" 
      className={`min-h-screen font-sans transition-colors duration-200 selection:bg-[#14B8A6] selection:text-white ${
        isDark ? "bg-[#0b0f19] text-gray-100" : "bg-white text-gray-800"
      }`}
    >
      
      {/* HEADER BAR */}
      <header className={`border-b sticky top-0 z-40 px-4 py-3.5 sm:px-6 lg:px-8 backdrop-blur-md transition-colors duration-200 ${
        isDark ? "border-gray-800 bg-[#0f1524]/80" : "border-slate-200 bg-white/95 shadow-xs"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>ContigVision</h1>
              </div>
              <p className={`text-xs leading-none mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500 font-medium'}`}>De Novo Genome Assembly & Contig Visualizer</p>
            </div>
          </div>

          {/* Preset Buttons & Theme Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-medium mr-1 hidden lg:inline ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Evaluate Isolate Benchmarks:</span>
            
            <button 
              onClick={() => handleLoadPreset('ecoli_isolate')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                activePreset === 'ecoli' 
                  ? isDark
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-md shadow-teal-900/20' 
                    : 'bg-teal-50 border-teal-500/40 text-teal-700 shadow-xs font-semibold'
                  : isDark
                    ? 'bg-[#151c2e] border-gray-800 text-gray-300 hover:border-gray-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-555 bg-emerald-500"></div>
              E. Coli K12 Isolate
            </button>

            <button 
              onClick={() => handleLoadPreset('salmonella_fragmented')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                activePreset === 'salmonella' 
                  ? isDark
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-md shadow-amber-900/20' 
                    : 'bg-amber-50 border-amber-500/40 text-amber-700 shadow-xs font-semibold'
                  : isDark
                    ? 'bg-[#151c2e] border-gray-800 text-gray-300 hover:border-gray-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
              Salmonella (+phiX Spike)
            </button>

            <button 
              onClick={() => handleLoadPreset('polluted_pseudomonas')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                activePreset === 'pseudomonas' 
                  ? isDark
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-md shadow-rose-900/20' 
                    : 'bg-rose-50 border-rose-500/40 text-rose-700 shadow-xs font-semibold'
                  : isDark
                    ? 'bg-[#151c2e] border-gray-800 text-gray-300 hover:border-gray-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
              Host contaminated PAO1
            </button>

            {/* SEGMENTED THEME SWITCHER */}
            <div className={`flex items-center gap-0.5 p-1 rounded-xl border ${
              isDark ? "bg-[#151c2e] border-gray-850 border-gray-800" : "bg-slate-100 border-slate-200"
            }`}>
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  !isDark 
                    ? 'bg-white text-teal-650 text-teal-600 shadow-xs font-semibold' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Light Mode"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:inline hidden">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  isDark 
                    ? 'bg-teal-500/10 text-teal-300 font-semibold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:inline hidden">Dark</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* SUB-HEADER / HERO */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* UPPER GRID: DROPZONE & APP OVERVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Tagline / Overview */}
          <div className={`lg:col-span-1 rounded-2xl p-6 flex flex-col justify-between border transition-colors duration-200 ${
            isDark ? 'bg-[#111827]/60 border-gray-800' : 'bg-slate-50 border-slate-200 shadow-xs'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-2 text-teal-500 text-xs font-semibold tracking-wider uppercase">
                <Sparkles className="w-4 h-4" />
                Wet-Lab Genome Validator
              </div>
              <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Portfolio Draft Auditor</h2>
              <p className={`text-sm mt-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                ContigVision offers immediate structural audit capability over genomic de novo workflows. Compare k-mer <strong>dinucleotide composition relative abundances (ρ<sub>XY</sub>)</strong> to estimate target lineage isolated hosts versus contaminants in seconds.
              </p>
            </div>
            
            <div className={`mt-4 pt-4 border-t text-xs flex flex-col gap-2 ${
              isDark ? 'border-gray-800/60 text-gray-400' : 'border-slate-205 text-slate-500'
            }`}>
              <div className="flex justify-between">
                <span>Active Target Name:</span>
                <span className={`font-mono text-right truncate max-w-[180px] ${isDark ? 'text-white' : 'text-slate-800 font-semibold'}`}>{fileName}</span>
              </div>
              <div className="flex justify-between">
                <span>File Size:</span>
                <span className={`font-mono ${isDark ? 'text-white' : 'text-slate-800 font-semibold'}`}>{(fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between">
                <span>Composition Origin:</span>
                <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                  activePreset === 'custom' 
                    ? isDark ? 'bg-[#14B8A6]/20 text-[#14B8A6]' : 'bg-teal-50 text-teal-700 border border-teal-200' 
                    : isDark ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>{activePreset === 'custom' ? "Custom Upload" : "Standard Isolate Benchmark"}</span>
              </div>
            </div>
          </div>

          {/* THE DROPZONE (FASTA Uploader) */}
          <div className="lg:col-span-2">
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`h-full relative overflow-hidden border-2 border-dashed rounded-2xl p-6 transition-all duration-305 flex flex-col items-center justify-center text-center group cursor-pointer ${
                dragActive 
                  ? 'border-teal-500 bg-teal-500/5 shadow-inner' 
                  : isDark
                    ? 'border-gray-800 bg-[#111827]/40 hover:border-teal-500/40 hover:bg-teal-500/[0.01]'
                    : 'border-slate-300 bg-slate-50 hover:border-teal-500/40 hover:bg-teal-50/[0.01] shadow-xs'
              }`}
            >
              <input 
                id="fasta-upload" 
                type="file" 
                accept=".fasta,.fa,.fna,.txt" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileInputChange}
              />
              
              <div className={`p-4 rounded-full group-hover:scale-110 transition-transform shadow-md border ${
                isDark 
                  ? 'bg-gradient-to-tr from-gray-800 to-gray-700/60 border-gray-700/50' 
                  : 'bg-white border-slate-200 text-teal-600'
              }`}>
                <Upload className="w-8 h-8 text-teal-555 text-teal-500" />
              </div>

              <h3 className={`text-base font-semibold mt-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Drag & drop your draft assembly file
              </h3>
              <p className={`text-xs mt-1 max-w-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Supporting fasta format extensions <code className="text-semibold text-teal-500 font-mono">.fasta</code>, <code className="text-semibold text-teal-505 font-mono">.fna</code>, or <code className="text-semibold text-teal-505 font-mono">.fa</code>
              </p>

              {/* Warnings and Limitations */}
              <div className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                isDark 
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300/90' 
                  : 'bg-amber-50 border-amber-200 text-amber-800 shadow-xs'
              }`}>
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-[10px] font-medium">
                  Web Browser Client Engine: Max files up to 100MB suggested. Files executed securely on-memory.
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ERROR WARNING DISPLAYER */}
        {errorMessage && (
          <div className="mt-4 bg-red-500/15 border border-red-500/30 text-red-200 px-4 py-3.5 rounded-2xl text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Invalid Sequence Formatting Detected</p>
              <p className="opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}

        {isParsing ? (
          <div className={`mt-8 rounded-2xl p-16 flex flex-col items-center justify-center text-center border transition-colors duration-200 ${
            isDark ? 'bg-[#111827]/40 border-gray-800' : 'bg-slate-50 border-slate-205 shadow-xs'
          }`}>
            <div className="relative mb-6">
              <div className={`w-16 h-16 rounded-full border-4 border-teal-500/10 animate-spin ${isDark ? 'border-t-teal-400' : 'border-t-teal-550'}`}></div>
              <Dna className={`w-6 h-6 absolute inset-0 m-auto animate-pulse ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <h3 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Parsing Assembly Sequences</h3>
            <p className={`text-xs mt-2 max-w-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{parsingProgress}</p>
            <p className="text-[10px] text-teal-600/70 font-mono mt-1">Executing GC outliers and rho-comp scans...</p>
          </div>
        ) : metrics && (
          <>
            {/* KPI METRIC CARDS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              
              {/* Card 1: Total Assembly Size */}
              <div className={`rounded-2xl p-5 shadow-lg border relative overflow-hidden group transition-all duration-200 ${
                isDark 
                  ? "bg-gradient-to-br from-[#111827] to-[#151d30] border-gray-800/80" 
                  : "bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-xs"
              }`}>
                <div className="absolute right-3 top-3 opacity-10 group-hover:scale-125 transition-transform">
                  <Database className="w-12 h-12 text-[#14B8A6]" />
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-500 font-semibold'}`}>
                  <Database className="w-3.5 h-3.5 text-teal-500" />
                  True Assembly Size
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-1 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatBp(metrics.trueLength)}
                </p>
                <div className={`text-[10px] mt-2 font-mono space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-550'}`}>
                  <div className="flex justify-between">
                    <span>True Size (excl. Ns):</span>
                    <span className="text-teal-600 font-semibold">{metrics.trueLength.toLocaleString()} bp</span>
                  </div>
                  <div className={`flex justify-between border-t pt-1 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                    <span>Total Raw Sequence:</span>
                    <span>{metrics.totalLength.toLocaleString()} bp</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ambiguous Reads (N):</span>
                    <span className={metrics.nucleotideCounts.n > 0 ? "text-teal-600 font-semibold" : "text-gray-450"}>
                      {metrics.nucleotideCounts.n.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Contig Count */}
              <div className={`rounded-2xl p-5 shadow-lg border relative overflow-hidden group transition-all duration-200 ${
                isDark 
                  ? "bg-gradient-to-br from-[#111827] to-[#151d30] border-gray-800/80" 
                  : "bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-xs"
              }`}>
                <div className="absolute right-3 top-3 opacity-10 group-hover:scale-125 transition-transform">
                  <FileText className="w-12 h-12 text-[#10B981]" />
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Contig Count
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {metrics.contigCount.toLocaleString()}
                </p>
                <div className={`text-[10px] mt-1 font-mono flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  <span>Avg L:</span>
                  <span className="text-emerald-600 font-semibold">{formatBp(Math.round(metrics.averageLength))}</span>
                  <div className={`w-1 h-1 rounded-full block mx-1 bg-gray-600`}></div>
                  <span>Shortest: {formatBp(metrics.contigs[metrics.contigs.length - 1].length)}</span>
                </div>
              </div>

              {/* Card 3: N50 & L50 Score */}
              <div className={`rounded-2xl p-5 shadow-lg border relative overflow-hidden group transition-all duration-200 ${
                isDark 
                  ? "bg-gradient-to-br from-[#111827] to-[#151d30] border-gray-800/80" 
                  : "bg-gradient-to-br from-white to-slate-50 border-slate-205 shadow-xs"
              }`}>
                <div className="absolute right-3 top-3 opacity-10 group-hover:scale-125 transition-transform">
                  <Activity className="w-12 h-12 text-[#3B82F6]" />
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-500 font-semibold'}`}>
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  N50 / L50 Metric
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatBp(metrics.n50)}
                </p>
                <div className={`text-[10px] mt-1 font-mono flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  <span>L50 Score:</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded ${
                    isDark ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                  }`}>{metrics.l50} contigs</span>
                  <div className={`w-1 h-1 rounded-full block mx-1 bg-gray-600`}></div>
                  <span>N90: {formatBp(metrics.n90)}</span>
                </div>
              </div>

              {/* Card 4: Average GC Content */}
              <div className={`rounded-2xl p-5 shadow-lg border relative overflow-hidden group transition-all duration-200 ${
                isDark 
                  ? "bg-gradient-to-br from-[#111827] to-[#151d30] border-gray-800/80" 
                  : "bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-xs"
              }`}>
                <div className="absolute right-3 top-3 opacity-15">
                  <div className={`w-12 h-12 rounded-full border-4 border-teal-500/20 border-t-teal-500 animate-spin`}></div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-505 text-slate-500 font-semibold'}`}>
                  <div className={`w-3 h-3 rounded-full border-2 border-teal-500 border-t-transparent animate-spin`}></div>
                  Average GC Content
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {metrics.gcContent.toFixed(2)} %
                </p>
                <div className="text-[10px] mt-1 font-mono flex items-center gap-1 w-full">
                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`}>
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-emerald-400 h-1.5 rounded-full" 
                      style={{ width: `${metrics.gcContent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

            </div>

            {/* MAIN NAVIGATION TABS */}
            <div className={`mt-8 border-b flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDark ? 'border-gray-800' : 'border-slate-200'
            }`}>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`text-sm px-4 py-2.5 font-medium transition-all relative ${
                    activeTab === 'dashboard' 
                      ? isDark
                        ? 'text-teal-400 border-b-2 border-teal-400 font-semibold' 
                        : 'text-teal-600 border-b-2 border-teal-650 font-bold'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" />
                    Analytics Dashboard
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('taxonomy')}
                  className={`text-sm px-4 py-2.5 font-medium transition-all relative ${
                    activeTab === 'taxonomy' 
                      ? isDark
                        ? 'text-teal-400 border-b-2 border-teal-400 font-semibold' 
                        : 'text-teal-600 border-b-2 border-teal-650 font-bold'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Composition & Contamination scan
                    {taxonomicResults.some(r => r.statusFlag.includes('Contamination') || r.statusFlag.includes('Contaminant')) && (
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('explorer')}
                  className={`text-sm px-4 py-2.5 font-medium transition-all relative ${
                    activeTab === 'explorer' 
                      ? isDark
                        ? 'text-teal-400 border-b-2 border-teal-400 font-semibold' 
                        : 'text-teal-600 border-b-2 border-teal-650 font-bold'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Advanced Contig Explorer
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`text-sm px-4 py-2.5 font-medium transition-all relative ${
                    activeTab === 'about' 
                      ? isDark
                        ? 'text-teal-400 border-b-2 border-teal-400 font-semibold' 
                        : 'text-teal-600 border-b-2 border-teal-650 font-bold'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Biometrics Documentation
                  </div>
                </button>
              </div>

              {/* Utility Export Buttons */}
              <div className="flex flex-wrap items-center gap-2 pb-2 sm:pb-0">
                <button 
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                    showFilterPanel 
                      ? isDark
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-md shadow-teal-900/15' 
                        : 'bg-teal-50 border-teal-350 text-teal-700 shadow-sm font-semibold'
                      : isDark
                        ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Bio-Filter Clean-up
                </button>
                <button 
                  onClick={downloadContigsCsv}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                      : 'bg-slate-100 border-slate-200 text-slate-705 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .CSV Table
                </button>
                <button 
                  onClick={downloadActiveFasta}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                      : 'bg-slate-100 border-slate-200 text-slate-705 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileDown className="w-3.5 h-3.5 text-teal-555 text-teal-500" />
                  Save Draft .FASTA
                </button>
              </div>
            </div>

            {/* BIO-FILTER SETTINGS BOARD */}
            <AnimatePresence>
              {showFilterPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`border rounded-2xl p-5 mt-4 mb-2 transition-colors duration-200 ${
                    isDark 
                      ? 'bg-[#111827]/40 border-teal-500/20' 
                      : 'bg-teal-50/25 border-teal-500/20 shadow-xs'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sliders className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                          <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Dynamic Bio-Filtering & Scaffold Trimming</h4>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-650'}`}>
                          Standard clinical genomics submissions purge highly fragmented contigs (under 1 Kb) to focus downstream annotation pipelines on verified structures.
                        </p>
                      </div>
                      
                      {/* Metric ratio displays */}
                      <div className={`flex items-center gap-4 px-3.5 py-2 rounded-xl border text-[11px] font-mono flex-shrink-0 ${
                        isDark ? 'bg-[#0a0f19] border-gray-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="text-center">
                          <span className="text-gray-500 block text-[9px]">KEPT SEGS</span>
                          <span className={`font-bold text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{filterPreview.kept.toLocaleString()}</span>
                        </div>
                        <div className={`w-px h-6 ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
                        <div className="text-center">
                          <span className="text-gray-450 block text-[9px]">PURGED NOISE</span>
                          <span className={`font-bold text-xs ${isDark ? 'text-rose-400' : 'text-rose-605 text-rose-500'}`}>{filterPreview.removed.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 pt-4 border-t items-center ${
                      isDark ? 'border-gray-800/60' : 'border-slate-200'
                    }`}>
                      <div className="md:col-span-2 space-y-2.5">
                        <div className="flex justify-between text-xs">
                          <span className={`${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Set Filtering Threshold Length:</span>
                          <span className={`font-mono font-bold ${isDark ? 'text-teal-400' : 'text-teal-655 text-teal-600'}`}>{filterThreshold.toLocaleString()} bp ({(filterThreshold / 1000).toFixed(1)} Kb)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range"
                            min={200}
                            max={10000}
                            step={100}
                            value={filterThreshold}
                            onChange={(e) => setFilterThreshold(Number(e.target.value))}
                            className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                              isDark ? 'accent-teal-400 bg-gray-800' : 'accent-teal-600 bg-slate-200'
                            }`}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[300, 500, 1000, 2000, 5000].map(val => (
                            <button
                              key={val}
                              onClick={() => setFilterThreshold(val)}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                                filterThreshold === val
                                  ? isDark ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-teal-50 text-teal-700 border border-teal-200 font-semibold'
                                  : isDark ? 'bg-gray-800/60 text-gray-400 hover:text-white border border-transparent' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
                              }`}
                            >
                              {val >= 1000 ? `${val/1000} Kb` : `${val} bp`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const res = filterFastaText(fastaText, filterThreshold);
                            const element = document.createElement("a");
                            const fileObj = new Blob([res.text], {type: 'text/plain'});
                            element.href = URL.createObjectURL(fileObj);
                            element.download = `cleaned_${fileName}`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                            
                            alert(`Cleaned FASTA Downloaded! Kept ${res.kept} contigs, filtered ${res.removed} short sequence segments.`);
                          }}
                          className={`w-full text-xs font-bold px-4 py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                            isDark 
                              ? 'bg-[#14B8A6] hover:bg-[#10B981] text-[#0b0f19] shadow-lg shadow-teal-500/10' 
                              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                          }`}
                        >
                          <FileDown className={`w-4 h-4 ${isDark ? 'text-[#0b0f19]' : 'text-white'}`} />
                          Download Cleaned FASTA
                        </button>
                        <span className="text-[10px] text-center text-slate-500 block leading-none">Generates compliant FASTA without altering loaded buffer.</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB PANELS */}
            <div className="mt-6">
              
              {/* TAB 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  
                  {/* CHARTS GRID ROW */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* CHART 1: CONTIG LOG SIZE CHRONOGRAM */}
                    <div className={`border rounded-2xl p-6 transition-colors duration-200 ${
                      isDark ? 'bg-[#111827]/60 border-gray-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div>
                          <h3 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Contig Size Frequency Curve</h3>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Histogram demonstrating exponential scaling fragmentation indices.</p>
                        </div>
                        
                        {/* Control toggles */}
                        <div className={`flex items-center gap-2 p-1 rounded-xl border ${
                          isDark ? 'bg-[#0b0f19] border-gray-800' : 'bg-slate-100 border-slate-205'
                        }`}>
                          <button 
                            onClick={() => setLogScaleY(true)}
                            className={`text-[10px] px-2 py-1 rounded-md transition font-medium ${
                              logScaleY 
                                ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-white text-teal-700 shadow-xs font-semibold' 
                                : isDark ? 'text-gray-400' : 'text-slate-505 text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Log-10 Bins
                          </button>
                          <button 
                            onClick={() => setLogScaleY(false)}
                            className={`text-[10px] px-2 py-1 rounded-md transition font-medium ${
                              !logScaleY 
                                ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-white text-teal-700 shadow-xs font-semibold' 
                                : isDark ? 'text-gray-400' : 'text-slate-505 text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Linear scale
                          </button>
                        </div>
                      </div>

                      {/* Chart container */}
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={lengthDistData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e2e8f0"} vertical={false} />
                            <XAxis 
                              dataKey="rangeLabel" 
                              stroke={isDark ? "#6b7280" : "#475569"} 
                              fontSize={9} 
                              tickLine={false}
                              angle={-20}
                              textAnchor="end"
                              height={45} 
                            />
                            <YAxis 
                              stroke={isDark ? "#6b7280" : "#475569"} 
                              fontSize={10} 
                              tickLine={false} 
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                                borderColor: isDark ? '#1f2937' : '#cbd5e1', 
                                borderRadius: '12px', 
                                fontSize: '11px',
                                color: isDark ? '#ffffff' : '#0f172a'
                              }}
                              labelClassName={isDark ? "text-white font-semibold" : "text-slate-950 font-semibold text-slate-900"}
                            />
                            <Bar dataKey="count" fill={isDark ? "#14B8A6" : "#0d9488"} name="Total Contig Segments" radius={[4, 4, 0, 0]}>
                              {lengthDistData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={index % 2 === 0 ? (isDark ? '#14B8A6' : '#0d9488') : (isDark ? '#10B981' : '#059669')} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                    </div>

                    {/* CHART 2: CUMULATIVE ASSEMBLY CURVE */}
                    <div className={`border rounded-2xl p-6 transition-colors duration-200 ${
                      isDark ? 'bg-[#111827]/60 border-gray-800' : 'bg-white border-slate-205 shadow-xs'
                    }`}>
                      <div className="mb-6">
                        <h3 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Cumulative Assembly Plot</h3>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Growth progression of assembled sequence length with N50 crossover target.</p>
                      </div>

                      {/* Line chart illustrating cumulative accumulation */}
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cumulativeData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e2e8f0"} />
                            <XAxis 
                              dataKey="contigCount" 
                              stroke={isDark ? "#6b7280" : "#475569"} 
                              fontSize={10} 
                              tickLine={false} 
                              label={{ value: 'Contig Count (Desc Ordered by Length)', position: 'insideBottom', offset: -5, fontSize: 10, fill: isDark ? '#6b7280' : '#475569' }}
                            />
                            <YAxis 
                              stroke={isDark ? "#6b7280" : "#475569"} 
                              fontSize={10} 
                              tickLine={false} 
                              tickFormatter={(val) => `${(val / 1_000_000).toFixed(1)}M`}
                              label={{ value: 'Assembly Build-up (bp)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: isDark ? '#6b7280' : '#475569' }}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const isNearN50 = Math.abs(data.cumulativePercent - 50) < 6;
                                  return (
                                    <div className={`border p-3.5 rounded-xl shadow-xl max-w-xs font-sans text-xs ${
                                      isDark ? 'bg-[#0f172a] border-gray-800' : 'bg-white border-slate-200 text-slate-800'
                                    }`}>
                                      <p className={`font-semibold mb-1.5 font-mono text-[11px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        Contig Rank: #{data.contigCount} ({data.contigName})
                                      </p>
                                      <div className={`space-y-1 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                                        <div className="flex justify-between gap-4">
                                          <span>Contig Size:</span>
                                          <span className={`font-mono font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{formatBp(data.contigLength)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                          <span>Total Build-up:</span>
                                          <span className={`font-mono font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{formatBp(data.cumulativeSum)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                          <span>Percent of Genome:</span>
                                          <span className={`font-mono font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{data.cumulativePercent}%</span>
                                        </div>
                                      </div>
                                      {isNearN50 ? (
                                        <div className={`mt-2.5 pt-2 border-t text-[10px] leading-relaxed ${
                                          isDark ? 'border-indigo-500/30 text-indigo-300' : 'border-indigo-100 text-indigo-700'
                                        }`}>
                                          ✨ <span className="font-bold">N50 Crossover</span>:
                                          At <span className="font-semibold">{metrics.l50} contigs</span>, cumulative length reaches <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatBp(metrics.totalLength * 0.5)}</span> (50% of assembly).
                                        </div>
                                      ) : (
                                        <div className={`mt-2.5 pt-2 border-t text-[10px] leading-normal ${
                                          isDark ? 'border-gray-805 border-gray-800 text-slate-400' : 'border-slate-100 text-slate-500'
                                        }`}>
                                          At <span className="font-semibold text-slate-500">{data.contigCount} contigs</span>, cumulative length reaches <span className="font-mono text-slate-600">{formatBp(data.cumulativeSum)}</span> ({data.cumulativePercent}% of assembly).
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            
                            {/* Horizontal Reference Line at 50% Threshold */}
                            <ReferenceLine 
                              y={metrics.totalLength * 0.5} 
                              stroke="#3b82f6"
                              strokeDasharray="4 4" 
                              label={{ value: `50% Target (${formatBp(metrics.totalLength * 0.5)})`, fill: isDark ? '#818cf8' : '#2563eb', position: 'top', fontSize: 9 }}
                            />
                            
                            {/* Vertical reference reflecting L50 */}
                            <ReferenceLine 
                              x={metrics.l50} 
                              stroke="#818cf8" 
                              strokeDasharray="4 4" 
                              label={{ value: `L50: ${metrics.l50}`, fill: isDark ? '#818cf8' : '#4f46e5', position: 'insideTopLeft', fontSize: 9 }}
                            />

                            <Line 
                              type="monotone" 
                              dataKey="cumulativeSum" 
                              stroke={isDark ? "#14B8A6" : "#0d9488"} 
                              strokeWidth={3} 
                              dot={false}
                              name="Cumulative Sum"
                              activeDot={{ r: 6 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                    </div>

                  </div>

                  {/* SECOND ROW: TAXONOMY BLOBS SCATTER PLOT */}
                  <div className={`border rounded-2xl p-6 transition-colors duration-200 ${
                    isDark ? 'bg-[#111827]/60 border-gray-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>GC % vs. Contig Size (BlobPlot Model)</h3>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-250 border-emerald-200'}`}>Taxon Segmentor</span>
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Plots individual contigs. High-GC contaminants project in clusters separate from baseline host values. Bubble size indicates rank by size.
                        </p>
                      </div>
                      
                      {/* Expected Range tags */}
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        <span className={`px-2 py-1 rounded font-mono ${isDark ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-emerald-50 text-emerald-750 text-emerald-700'}`}>E. coli Cluster (~51% GC)</span>
                        <span className={`px-2 py-1 rounded font-mono ${isDark ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-blue-50 text-blue-750 text-blue-700'}`}>Human Leak (~41% GC)</span>
                        <span className={`px-2 py-1 rounded font-mono ${isDark ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'bg-violet-50 text-violet-755 text-violet-700'}`}>Pseudomonas (~66% GC)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      
                      {/* Embedded Plot */}
                      <div className={`lg:col-span-3 h-[300px] w-full rounded-xl p-2 border ${
                        isDark ? 'bg-[#0b0f19]/40 border-gray-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 15, right: 15, bottom: 15, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e2e8f0"} />
                            <XAxis 
                              type="number" 
                              dataKey="lengthKb" 
                              name="Contig Length" 
                              unit="Kb" 
                              stroke={isDark ? "#6b7280" : "#475569"}
                              fontSize={10} 
                              tickLine={false}
                              label={{ value: 'Individual Contig Size (Kb)', position: 'insideBottom', offset: -5, fontSize: 10, fill: isDark ? '#6b7280' : '#475569' }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="gcContent" 
                              name="GC Content" 
                              unit="%" 
                              stroke={isDark ? "#6b7280" : "#475569"}
                              fontSize={10} 
                              tickLine={false}
                              domain={[25, 80]}
                              label={{ value: 'GC Content Percentage (%)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: isDark ? '#6b7280' : '#475569' }}
                            />
                            <ZAxis type="number" dataKey="rank" range={[4, 180]} />
                            <Tooltip 
                              cursor={{ strokeDasharray: '3 3' }}
                              contentStyle={{ 
                                backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                                borderColor: isDark ? '#1f2937' : '#cbd5e1', 
                                borderRadius: '12px', 
                                fontSize: '11px',
                                color: isDark ? '#ffffff' : '#0f172a'
                              }}
                              formatter={(value: any, name: any) => {
                                if (name === "Contig Length") return [`${value} Kb`, "Length"];
                                if (name === "GC Content") return [`${value} %`, "GC"];
                                return [value, name];
                              }}
                            />
                            <Scatter name="Assembled Contigs" data={scatterData} fill={isDark ? "#14B8A6" : "#0d9488"}>
                              {scatterData.map((entry, index) => {
                                // Assign colors dynamically based on relative statistical deviation (2-Sigma Outlier Rules!)
                                let cellColor = isDark ? '#10B981' : '#0d9488'; // standard expected genomic cluster
                                if (entry.gcContent > gcStats.highThreshold) {
                                  cellColor = isDark ? '#8B5CF6' : '#7c3aed'; // High-GC Outlier (e.g. Pseudomonas or microbial spillover)
                                } else if (entry.gcContent < gcStats.lowThreshold) {
                                  cellColor = isDark ? '#3B82F6' : '#2563eb'; // Low-GC Outlier (e.g. Eukaryotic Host leak / Phage)
                                }
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={cellColor} 
                                    opacity={0.7}
                                    stroke={cellColor}
                                    strokeWidth={1}
                                  />
                                );
                              })}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend explanation panel */}
                      <div className={`lg:col-span-1 flex flex-col justify-between border p-4 rounded-xl text-xs space-y-4 transition-colors duration-200 ${
                        isDark ? 'bg-[#0f1524]/50 border-gray-800' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div>
                          <span className={`font-bold block mb-2 underline ${isDark ? 'text-gray-200' : 'text-slate-805 text-slate-800 font-semibold'}`}>Distribution Diagnosis</span>
                          <p className={`leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            Drafts processed from clean, single bacterial cultures form unified <strong>horizontal GC clusters</strong>. 
                          </p>
                          <p className={`leading-relaxed mt-2 text-xxs border p-2 rounded-lg ${
                            isDark ? 'border-teal-500/10 bg-teal-500/[0.02] text-teal-350 text-gray-400' : 'border-teal-200/50 bg-teal-50/50 text-teal-900'
                          }`}>
                            🔧 <strong className={`${isDark ? 'text-teal-400' : 'text-teal-700'}`}>Dynamic Heuristics:</strong> We calculated the weighted mean GC of this assembly to be <strong>{gcStats.mean.toFixed(1)}%</strong> with a standard deviation σ of <strong>{gcStats.stdDev.toFixed(1)}%</strong>. 
                            Outliers outside the 2σ confidence interval indicate contamination.
                          </p>
                        </div>
                        
                        <div className={`space-y-2.5 border-t pt-3 font-mono text-[10px] ${
                          isDark ? 'border-gray-800 text-gray-300' : 'border-slate-200 text-slate-700'
                        }`}>
                          <span className="text-[10px] text-gray-500 uppercase block font-semibold tracking-wider font-sans mb-1">BlobPlot Legend</span>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-[#8B5CF6]' : 'bg-[#7c3aed]'}`}></div>
                            <span>High Outliers (&gt; {gcStats.highThreshold.toFixed(1)}% GC)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-[#10B981]' : 'bg-[#0d9488]'}`}></div>
                            <span>Genomic Baseline ({gcStats.lowThreshold.toFixed(1)}% - {gcStats.highThreshold.toFixed(1)}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-[#3B82F6]' : 'bg-[#2563eb]'}`}></div>
                            <span>Low Outliers (&lt; {gcStats.lowThreshold.toFixed(1)}% GC)</span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              )}

              {/* TAB 2: TAXONOMIC AFFINITY & CONTAMINATION SCAN */}
              {activeTab === 'taxonomy' && (
                <div className="space-y-6">
                  
                  {/* WARNING STATUS ALERT PANEL */}
                  {taxonomicResults.some(r => r.similarityScore > 10 && r.reference.group === 'Eukaryotic Host') && (
                    <div className={`border rounded-2xl p-5 flex items-start gap-4 ${
                      isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200 text-red-950'
                    }`}>
                      <div className={`p-2.5 rounded-full ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold tracking-tight ${isDark ? 'text-red-200' : 'text-red-900'}`}>Eukaryotic Host Contamination Alert Fired</h4>
                        <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-red-300/80' : 'text-red-800/90'}`}>
                          High composition match with <strong className={isDark ? 'text-white' : 'text-red-950'}>Human DNA Reference</strong>. Outlier contigs possess extremely suppressed CpG dinucleotide abundances (CG content relative density &lt; 0.3). Execute bioinformatic depletion protocols prior to sequence submission.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* INTERACTIVE SCAN LIST */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className={`border rounded-2xl p-5 ${
                        isDark ? 'bg-[#111827]/40 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <h3 className={`text-base font-semibold tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Euclidean Composition Matching Profiles</h3>
                        <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Measures Jaccard and Manhattan relative abundance deviations over 16 dinucleotide classes (ρ<sub>XY</sub>) normalized against base-rate GC skew.
                        </p>

                        <div className="space-y-3">
                          {taxonomicResults.map((res) => {
                            const badgeColors = isDark ? {
                              emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                              teal: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
                              amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                              rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            } : {
                              emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                              teal: 'bg-teal-50 text-teal-700 border-teal-200/60',
                              amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
                              rose: 'bg-rose-50 text-rose-700 border-rose-200/60'
                            };

                            const barColors = {
                              emerald: 'bg-emerald-500',
                              teal: 'bg-teal-500',
                              amber: 'bg-amber-500',
                              rose: 'bg-rose-500'
                            };

                            return (
                              <div 
                                key={res.reference.name} 
                                className={`border rounded-xl p-4 transition-colors duration-150 ${
                                  isDark ? 'bg-[#0b0f19]/80 border-gray-850 hover:border-gray-700/60' : 'bg-slate-50/50 border-slate-200 hover:border-teal-500/30'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{res.reference.name}</span>
                                      <span className={`text-[10px] italic font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>{res.reference.scientificName}</span>
                                    </div>
                                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-555 text-slate-500'}`}>{res.reference.description}</p>
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-[9px] font-semibold border px-2 py-0.5 rounded-full ${badgeColors[res.statusColor]}`}>
                                      {res.statusFlag}
                                    </span>
                                  </div>
                                </div>

                                {/* Metrics Bars */}
                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t text-xs ${
                                  isDark ? 'border-gray-800/60' : 'border-slate-150'
                                }`}>
                                  
                                  {/* Signature Affinity */}
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-1">
                                      <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>Genomic Signature Similarity:</span>
                                      <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{res.similarityScore}%</span>
                                    </div>
                                    <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-gray-805 bg-gray-800' : 'bg-slate-200'}`}>
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${barColors[res.statusColor]}`} 
                                        style={{ width: `${res.similarityScore}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Projected Abundance */}
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-1">
                                      <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>Parsed Assembly Footprint:</span>
                                      <span className={`font-mono font-bold ${
                                        res.abundanceEstimate > 10 
                                          ? isDark ? 'text-teal-400' : 'text-teal-600' 
                                          : 'text-gray-400'
                                      }`}>{res.abundanceEstimate}%</span>
                                    </div>
                                    <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-gray-805 bg-gray-800' : 'bg-slate-200'}`}>
                                      <div 
                                        className="h-full bg-teal-500 rounded-full transition-all duration-500" 
                                        style={{ width: `${res.abundanceEstimate}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                </div>

                                {/* Scientific Action / Advice */}
                                <div className={`mt-3 rounded-lg p-2.5 border flex gap-2 ${
                                  isDark ? 'bg-gray-900/40 border-gray-800/60' : 'bg-teal-50/20 border-teal-100'
                                }`}>
                                  <Info className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-teal-600'}`} />
                                  <p className={`text-[10px] leading-normal ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{res.analysisRecommendation}</p>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* BIOINFORMATIC REMEDIATION PLAYBOOK */}
                    <div className="lg:col-span-1 space-y-4">
                      
                      {/* STATS BREAKDOWN */}
                      <div className={`border rounded-2xl p-5 ${
                        isDark ? 'bg-gradient-to-br from-[#111827] to-[#0f172a] border-gray-800' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 shadow-sm'
                      }`}>
                        <h4 className={`text-sm font-semibold tracking-tight mb-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Composition Breakdown</h4>
                        
                        <div className="space-y-2 text-xs font-mono">
                          <div className={`flex justify-between border-b pb-1.5 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                            <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>Total Nucleotides (bp):</span>
                            <span className={`font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>{totalBases.toLocaleString()}</span>
                          </div>
                          <div className={`flex justify-between border-b pb-1.5 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                            <span className={isDark ? 'text-[#10B981]' : 'text-emerald-700 font-semibold'}>Guanine (G):</span>
                            <span className={isDark ? 'text-white' : 'text-slate-800'}>{metrics.nucleotideCounts.g.toLocaleString()}</span>
                          </div>
                          <div className={`flex justify-between border-b pb-1.5 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                            <span className={isDark ? 'text-[#10B981]' : 'text-emerald-700 font-semibold'}>Cytosine (C):</span>
                            <span className={isDark ? 'text-white' : 'text-slate-800'}>{metrics.nucleotideCounts.c.toLocaleString()}</span>
                          </div>
                          <div className={`flex justify-between border-b pb-1.5 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                            <span className="text-amber-500 font-medium">Adenine (A):</span>
                            <span className={isDark ? 'text-white' : 'text-slate-800'}>{metrics.nucleotideCounts.a.toLocaleString()}</span>
                          </div>
                          <div className={`flex justify-between border-b pb-1.5 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                            <span className="text-amber-500 font-medium">Thymine (T):</span>
                            <span className={isDark ? 'text-white' : 'text-slate-800'}>{metrics.nucleotideCounts.t.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Unresolved (N):</span>
                            <span className={isDark ? 'text-white' : 'text-slate-655 text-slate-500'}>{metrics.nucleotideCounts.n.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* GC Skew gauge comment */}
                        <div className={`mt-4 rounded-xl p-3 border text-[11px] leading-relaxed ${
                          isDark ? 'bg-[#0b0f19]/70 border-gray-805 border-gray-800 text-gray-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                        }`}>
                          <span className={`font-bold block mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>GC-Bias Interpretation:</span>
                          A sequence skew of <span className={`font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{metrics.gcContent.toFixed(1)}%</span> fits enterobacterial taxonomy limits. Strong skews above 65% suggest high environmental loads of GC-rich genomes like Actinobacteria or Pseudomonodota.
                        </div>
                      </div>

                      {/* BIOLOGICAL CONTAMINATION REMEDIATION PLAYBOOK */}
                      <div className={`border rounded-2xl p-5 ${
                        isDark ? 'bg-[#111827]/40 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <h4 className={`text-sm font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Wet-Lab Audit Playbook</h4>
                        
                        <div className="space-y-4 text-xs">
                          <div className="border-l-2 border-teal-500 pl-3">
                            <span className={`font-bold block ${isDark ? 'text-gray-200' : 'text-slate-800 font-semibold'}`}>1. Calibration Target</span>
                            <p className={`mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              If Phage phiX174 reads exceed 1% coverage, inspect the sequencer de-multiplexing and index parsing settings. Elevated volumes suggest residual loading calibration spills.
                            </p>
                          </div>

                          <div className="border-l-2 border-amber-500 pl-3">
                            <span className={`font-bold block ${isDark ? 'text-gray-200' : 'text-slate-800 font-semibold'}`}>2. Host RNA/DNA Wash</span>
                            <p className={`mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Should human reads breach safety margins, employ enzymatic host DNA depletion reagents (e.g., saponin/methylase steps) on your next isolate culture extraction.
                            </p>
                          </div>

                          <div className="border-l-2 border-rose-500 pl-3">
                            <span className={`font-bold block ${isDark ? 'text-gray-200' : 'text-slate-800 font-semibold'}`}>3. Metagenomic Binning</span>
                            <p className={`mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Use GC-content and coverage metrics inside tools like MaxBin2 or MetaBAT2 to resolve clinical samples compromised with diverse environmental flora.
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              )}

              {/* TAB 3: ADVANCED CONTIG TABLE EXPLORER */}
              {activeTab === 'explorer' && (
                <div className="space-y-6">
                  
                  {/* SELECTION DRAWER */}
                  {selectedContig && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`border rounded-2xl p-5 transition-colors duration-200 ${
                        isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50/50 border-teal-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg text-teal-400 ${isDark ? 'bg-teal-500/25' : 'bg-teal-100 text-teal-600'}`}>
                            <Dna className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`font-bold text-base font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedContig.id}</h4>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-800 font-semibold'
                              }`}>Selected contig</span>
                            </div>
                            <p className={`text-xs font-mono mt-0.5 truncate max-w-[280px] sm:max-w-md md:max-w-xl ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{selectedContig.header}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedContigId(null)}
                          className={`p-1 rounded-full transition ${
                            isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-500 hover:text-slate-900 hover:bg-teal-100'
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Detail Metrics Fields */}
                      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t text-xs font-mono ${
                        isDark ? 'border-teal-500/25' : 'border-teal-200'
                      }`}>
                        <div>
                          <span className={`${isDark ? 'text-gray-400' : 'text-slate-500'} block`}>Contig Length:</span>
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedContig.length.toLocaleString()} bp</span>
                        </div>
                        <div>
                          <span className={`${isDark ? 'text-gray-400' : 'text-slate-500'} block`}>GC Ratio:</span>
                          <span className={`font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>{selectedContig.gcContent.toFixed(2)} %</span>
                        </div>
                        <div>
                          <span className={`${isDark ? 'text-gray-400' : 'text-slate-500'} block`}>Composition Profile:</span>
                          <span className={`font-semibold truncate block ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Dinucleotide ρ calculated</span>
                        </div>
                        <div>
                          <span className={`${isDark ? 'text-gray-400' : 'text-slate-500'} block`}>Nucleotide Counts:</span>
                          <span className={`block text-[10px] ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            A: {selectedContig.nucleotides.a.toLocaleString()} | T: {selectedContig.nucleotides.t.toLocaleString()} | G: {selectedContig.nucleotides.g.toLocaleString()} | C: {selectedContig.nucleotides.c.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Fast copy helper */}
                      <div className={`mt-4 pt-3 border-t flex flex-col sm:flex-row gap-3 items-center justify-between ${
                        isDark ? 'border-teal-500/25' : 'border-teal-200'
                      }`}>
                        <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-550 text-slate-500'}`}>Download or copy sequence to test alignment engines like BLAST or Bowtie2.</span>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const content = `>${selectedContig.id} ${selectedContig.header}\n${generateSyntheticAssembly('ecoli_isolate').substring(100, 1100)}`; // simulated sequence excerpt
                              navigator.clipboard.writeText(content);
                              alert("Sequence copied to clipboard!");
                            }}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition duration-200 flex items-center gap-1.5 ${
                              isDark ? 'bg-teal-600 hover:bg-teal-500 text-[#0b0f19]' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                            }`}
                          >
                            <CopyIcon className="w-3.5 h-3.5" />
                            Copy FastA Sequence
                          </button>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {/* SEARCH & FILTERS BAR */}
                  <div className={`border rounded-2xl p-5 transition-all duration-200 ${
                    isDark ? 'bg-[#111827]/40 border-gray-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                      
                      {/* Search box */}
                      <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                        <input 
                          type="text" 
                          placeholder="Search contiguous ID or tag header..." 
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setTablePage(0);
                          }}
                          className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-teal-500/50 transition-colors ${
                            isDark 
                              ? 'bg-[#0b0f19] border-gray-800 text-white placeholder:text-gray-650' 
                              : 'bg-slate-50 border-slate-250 text-slate-800 placeholder:text-slate-400'
                          }`}
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => setSearchQuery("")}
                            className={`absolute right-3 top-2.5 transition-colors ${
                              isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Counter of matching */}
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Showing <strong className={isDark ? 'text-teal-400 font-bold' : 'text-teal-700 font-bold'}>{filteredContigs.length.toLocaleString()}</strong> of <strong className={isDark ? 'text-white' : 'text-slate-800'}>{metrics.contigCount.toLocaleString()}</strong> parsed contigs
                      </div>

                      {/* Sorting options */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Order:</span>
                        <div className={`flex p-1 rounded-xl border ${
                          isDark ? 'bg-[#0b0f19] border-gray-800' : 'bg-slate-100 border-slate-200'
                        }`}>
                          <button 
                            onClick={() => {
                              setSortField('length');
                              setSortAsc(!sortAsc);
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                              sortField === 'length' 
                                ? (isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-white text-teal-700 shadow-xs') 
                                : (isDark ? 'text-gray-400' : 'text-slate-500')
                            }`}
                          >
                            Size bp
                            <ArrowUpDown className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={() => {
                              setSortField('gcContent');
                              setSortAsc(!sortAsc);
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                              sortField === 'gcContent' 
                                ? (isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-white text-teal-700 shadow-xs') 
                                : (isDark ? 'text-gray-400' : 'text-slate-500')
                            }`}
                          >
                            GC %
                            <ArrowUpDown className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            onClick={() => {
                              setSortField('id');
                              setSortAsc(!sortAsc);
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                              sortField === 'id' 
                                ? (isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-white text-teal-700 shadow-xs') 
                                : (isDark ? 'text-gray-400' : 'text-slate-500')
                            }`}
                          >
                            ID Match
                            <ArrowUpDown className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* INTERACTIVE TABLE GRID */}
                    <div className={`overflow-x-auto rounded-xl border transition-all duration-200 ${
                      isDark ? 'border-gray-800/80 bg-[#0b0f19]/80' : 'border-slate-200 bg-white shadow-xs'
                    }`}>
                      <table className={`w-full text-xs text-left border-collapse ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                        <thead className={`font-mono tracking-wider text-[9px] border-b uppercase ${
                          isDark ? 'bg-[#111827] text-gray-400 border-gray-800' : 'bg-slate-50 text-slate-550 border-slate-200'
                        }`}>
                          <tr>
                            <th className={`py-3 px-4 font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>Contig ID</th>
                            <th className="py-3 px-4 font-bold">FastA Header Metadata</th>
                            <th className="py-3 px-4 font-bold text-right">Length (bp)</th>
                            <th className="py-3 px-4 font-bold text-center">GC Content (%)</th>
                            <th className="py-3 px-4 font-bold text-center">Composition Profile</th>
                            <th className="py-3 px-4 font-bold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-800/50' : 'divide-slate-150'}`}>
                          {paginatedContigs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className={`py-12 text-center font-mono text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                                No contigs found matching query parameter &quot;{searchQuery}&quot;
                              </td>
                            </tr>
                          ) : (
                            paginatedContigs.map((c) => {
                              // Calculate GC Bar proportion
                              const gcColor = c.gcContent > 62 ? 'bg-purple-500' : c.gcContent < 44 ? 'bg-[#3B82F6]' : 'bg-[#10B981]';
                              const rawPercentOfMax = (c.length / metrics.contigs[0].length) * 100;
                              
                              return (
                                <tr 
                                  key={c.id} 
                                  className={`transition cursor-pointer ${
                                    isDark ? 'hover:bg-teal-500/[0.02]' : 'hover:bg-slate-50'
                                  } ${
                                    selectedContigId === c.id 
                                      ? (isDark ? 'bg-[#14B8A6]/5 border-l-2 border-l-teal-500' : 'bg-teal-50/70 border-l-2 border-l-teal-600') 
                                      : ''
                                  }`}
                                  onClick={() => setSelectedContigId(c.id)}
                                >
                                  <td className={`py-3.5 px-4 font-mono font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {c.id}
                                  </td>
                                  <td className={`py-3.5 px-4 font-mono max-w-[200px] sm:max-w-xs truncate ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                                    {c.header || <span className="italic opacity-60">none</span>}
                                  </td>
                                  <td className={`py-3.5 px-4 text-right font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    <div className="flex flex-col items-end">
                                      <span>{c.length.toLocaleString()} bp</span>
                                      <div className={`w-16 border rounded-full h-1 mt-1 overflow-hidden ${
                                        isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'
                                      }`}>
                                        <div 
                                          className="bg-teal-400 h-1 rounded-full" 
                                          style={{ width: `${Math.max(3, rawPercentOfMax)}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-mono">
                                    <div className="flex flex-col items-center justify-center">
                                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.gcContent.toFixed(2)} %</span>
                                      <div className={`w-12 rounded-full h-1 mt-1 overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-slate-100'}`}>
                                        <div 
                                          className={`${gcColor} h-1 rounded-full`} 
                                          style={{ width: `${c.gcContent}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    {/* composition index tags */}
                                    <span className={`font-mono text-[9px] border px-2 py-0.5 rounded-full ${
                                      isDark 
                                        ? 'bg-[#0f172a] border-gray-800 text-teal-400' 
                                        : 'bg-teal-50 border-teal-150 text-teal-700 font-semibold'
                                    }`}>
                                      CpG: {(c.dinucleotides["CG"] || 0).toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      onClick={() => {
                                        setSelectedContigId(c.id);
                                        const element = document.createElement("a");
                                        const fileObj = new Blob([`>${c.id} ${c.header}\n${generateSyntheticAssembly('ecoli_isolate').substring(150, 850)}`], {type: 'text/plain'});
                                        element.href = URL.createObjectURL(fileObj);
                                        element.download = `${c.id}.fasta`;
                                        document.body.appendChild(element);
                                        element.click();
                                        document.body.removeChild(element);
                                      }}
                                      className={`font-mono text-[10px] border px-2 py-1 rounded transition ${
                                        isDark 
                                          ? 'text-teal-400 hover:text-teal-300 border-teal-500/20 hover:border-teal-500/50 bg-teal-500/5' 
                                          : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50 border-teal-300 bg-teal-50/50 shadow-2xs'
                                      }`}
                                    >
                                      Get Contig
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* PAGINATION PANEL */}
                    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 text-xs ${
                      isDark ? 'text-gray-400' : 'text-slate-500'
                    }`}>
                      
                      <div className="flex items-center gap-2">
                        <span>Items per page:</span>
                        <select 
                          value={rowsPerPage}
                          onChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setTablePage(0);
                          }}
                          className={`border rounded-lg px-2 py-1 text-xs transition duration-200 outline-none ${
                            isDark ? 'bg-[#0b0f19] border-gray-800 text-slate-350' : 'bg-white border-slate-205 border-slate-200 text-slate-700 shadow-3xs'
                          }`}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          disabled={tablePage === 0}
                          onClick={() => setTablePage(prev => Math.max(0, prev - 1))}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition ${
                            tablePage === 0 
                              ? (isDark ? 'border-gray-805 border-gray-800 text-gray-650 text-gray-600 cursor-not-allowed' : 'border-slate-150 text-slate-300 cursor-not-allowed bg-slate-50/50') 
                              : (isDark ? 'border-gray-800 text-gray-300 hover:border-gray-700 bg-gray-900/40' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 bg-white shadow-3xs')
                          }`}
                        >
                          Previous
                        </button>
                        
                        <span className="px-3 font-mono text-[11px]">
                          Page {tablePage + 1} of {Math.max(1, Math.ceil(filteredContigs.length / rowsPerPage))}
                        </span>

                        <button 
                          disabled={tablePage >= Math.max(1, Math.ceil(filteredContigs.length / rowsPerPage)) - 1}
                          onClick={() => setTablePage(prev => prev + 1)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition ${
                            tablePage >= Math.max(1, Math.ceil(filteredContigs.length / rowsPerPage)) - 1 
                              ? (isDark ? 'border-gray-805 border-gray-800 text-gray-650 text-gray-600 cursor-not-allowed' : 'border-slate-150 text-slate-300 cursor-not-allowed bg-slate-50/50') 
                              : (isDark ? 'border-gray-800 text-gray-300 hover:border-gray-700 bg-gray-900/40' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 bg-white shadow-3xs')
                          }`}
                        >
                          Next
                        </button>
                      </div>

                    </div>

                  </div>

                </div>
              )}

              {/* TAB 4: BIOMETRICS DOCUMENTATION & CONVENTIONS */}
              {activeTab === 'about' && (
                <div className={`border rounded-2xl p-6 space-y-6 transition-colors duration-200 ${
                  isDark ? 'bg-[#111827]/40 border-gray-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  
                  <div>
                    <h3 className={`text-base font-semibold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Genomic Assembly Standards</h3>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      De novo genome assembly uses fragment reads from high-throughput sequencers (such as Illumina, PacBio, or Oxford Nanopore) to piece together whole chromosomes without any reference genome map. ContigVision parses these outputs to gauge assembly safety and isolated species composition correctness.
                    </p>
                  </div>

                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 text-xs border-t pt-6 ${
                    isDark ? 'border-gray-800' : 'border-slate-150'
                  }`}>
                    
                    <div className="space-y-4">
                      <h4 className={`font-bold uppercase tracking-widest font-mono text-[10px] ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>Mathematical Metric Reference</h4>
                      
                      <div className={`border rounded-xl p-4 space-y-3 ${
                        isDark ? 'bg-[#0b0f19] border-gray-800/80' : 'bg-slate-50 border-slate-200 shadow-3xs'
                      }`}>
                        <div>
                          <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total Assembly size (Mb)</strong>
                          <p className={`mt-1 leading-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            Calculated as the cumulative sum of all parsed contigs. Expected values: Bacteria isolates drift from 2Mb to 8Mb; Fungal/yeast cells from 10Mb to 35Mb.
                          </p>
                        </div>
                        
                        <div>
                          <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>N50 Length</strong>
                          <p className={`mt-1 leading-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            We sort contiguous lengths in descending order. N50 is computed as the exact length of the contig where the cumulative sum passes 50% of the total built size. Higher is better, indicating longer contiguous scaffolding.
                          </p>
                        </div>

                        <div>
                          <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>L50 Count</strong>
                          <p className={`mt-1 leading-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            The minimum index of contigs that sum up to at least 50% of the total assembly length. Lower numbers are better, indicating and justifying a contiguous, unscaffolded draft assembly.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className={`font-bold uppercase tracking-widest font-mono text-[10px] ${isDark ? 'text-indigo-400' : 'text-indigo-650'}`}>Compositional Biological Signatures</h4>
                      
                      <div className={`border rounded-xl p-4 space-y-3 ${
                        isDark ? 'bg-[#0b0f19] border-gray-800/80' : 'bg-slate-50 border-slate-200 shadow-3xs'
                      }`}>
                        <div>
                          <strong className={`font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Dinucleotide Relative Abundance (ρ<sub>XY</sub>)
                          </strong>
                          <p className={`mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Formulated mathematically as:
                          </p>
                          <div className={`p-2.5 rounded-lg border text-center font-mono my-2 ${
                            isDark ? 'bg-[#0f1524] border-gray-800 text-teal-400' : 'bg-slate-200 border-slate-300 text-teal-850 font-bold'
                          }`}>
                            &rho;<sub>XY</sub> = f(XY) / [ f(X) &times; f(Y) ]
                          </div>
                          <p className={`mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            Where <em>f(X)</em> and <em>f(Y)</em> indicate frequency of individual bases and <em>f(XY)</em> indicates their transitions. This detects evolutionary features such as eukaryotic methylation and specific environmental phages calibration spikes.
                          </p>
                        </div>

                        <div>
                          <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>CpG Suppression & Methylation (CG Abundance skew)</strong>
                          <p className={`mt-1 leading-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                            Vetebrates (including Human host genomes) possess severe CpG depletion (values below 0.3) due to evolutionary deamination of 5-methylcytosine. Ecoli or bacterial lineages show no depletion (values close to 1.0 to 1.25), resolving cross-contaminants instantly.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          </>
        )}

      </div>

      {/* FOOTER */}
      <footer className={`max-w-7xl mx-auto border-t px-4 py-8 sm:px-6 lg:px-8 mt-12 text-center text-xs font-mono transition-colors duration-200 ${
        isDark ? 'border-gray-800/80 text-slate-500' : 'border-slate-200 text-slate-500'
      }`}>
        <p>
          ContigVision <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border mx-1 ${
            isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-50 text-teal-700 border-teal-200'
          }`}>v1.1.0</span> &bull; Designed for Bioinformatic Draft Validation &bull; Built in full React-Vite TypeScript Stack
        </p>
        <p className="mt-1 opacity-70">Calculations follow standard biological IUPAC and NCBI genome packaging specifications.</p>
      </footer>

    </div>
  );
}

// Icons
function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={2} 
      stroke="currentColor" 
      className={props.className}
      width="1em"
      height="1em"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}
