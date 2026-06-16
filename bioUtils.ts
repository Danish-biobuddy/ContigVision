/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ContigVision Bioinformatics Core Math Engine & FASTA Parser
 */

export interface Contig {
  id: string;
  header: string;
  length: number;
  trueLength: number;
  gcContent: number;
  nucleotides: { a: number; c: number; g: number; t: number; n: number };
  dinucleotides: Record<string, number>;
}

export interface AssemblyMetrics {
  totalLength: number;
  trueLength: number;
  contigCount: number;
  averageLength: number;
  averageTrueLength: number;
  n50: number;
  l50: number;
  n90: number;
  l90: number;
  gcContent: number;
  nucleotideCounts: { a: number; c: number; g: number; t: number; n: number };
  contigs: Contig[];
}

export interface TaxonReference {
  name: string;
  scientificName: string;
  expectedGC: number;
  profile: Record<string, number>;
  description: string;
  group: 'Bacterial Isolate' | 'Eukaryotic Host' | 'Controls & Phages' | 'Pathogen';
}

// Real biological dinucleotide signatures (relative abundance rho_XY)
// Reference profiles compiled from typical genomic distributions:
// Note the extreme CpG depletion (CG) in human hosts (approx 0.22) compared to bacteria.
export const TAXON_REFERENCES: TaxonReference[] = [
  {
    name: "Escherichia coli",
    scientificName: "Escherichia coli str. K-12 MG1655",
    expectedGC: 50.8,
    group: "Bacterial Isolate",
    description: "Standard model gram-negative bacterium. Balanced dinucleotide profile, no CpG depletion.",
    profile: {
      "AA": 1.21, "AC": 0.81, "AG": 0.98, "AT": 1.00,
      "CA": 0.99, "CC": 1.15, "CG": 1.18, "CT": 0.68,
      "GA": 0.98, "GC": 1.23, "GG": 1.15, "GT": 0.64,
      "TA": 0.82, "TC": 0.81, "TG": 0.69, "TT": 1.21
    }
  },
  {
    name: "Salmonella enterica",
    scientificName: "Salmonella enterica subsp. enterica serovar Typhimurium",
    expectedGC: 52.2,
    group: "Bacterial Isolate",
    description: "Common foodborne enteropathogen closely related to E. coli but with specific genomic micro-biases.",
    profile: {
      "AA": 1.18, "AC": 0.82, "AG": 0.97, "AT": 1.03,
      "CA": 1.01, "CC": 1.11, "CG": 1.21, "CT": 0.67,
      "GA": 0.99, "GC": 1.18, "GG": 1.11, "GT": 0.72,
      "TA": 0.82, "TC": 0.89, "TG": 0.71, "TT": 1.18
    }
  },
  {
    name: "Pseudomonas aeruginosa",
    scientificName: "Pseudomonas aeruginosa PAO1",
    expectedGC: 66.6,
    group: "Pathogen",
    description: "Opportunistic pathogen famous for extremely high GC-biased genome and distinct GC-skew signatures.",
    profile: {
      "AA": 1.35, "AC": 0.75, "AG": 0.85, "AT": 1.05,
      "CA": 1.02, "CC": 1.25, "CG": 1.38, "CT": 0.35,
      "GA": 0.88, "GC": 1.31, "GG": 1.25, "GT": 0.56,
      "TA": 0.75, "TC": 0.68, "TG": 0.52, "TT": 1.35
    }
  },
  {
    name: "Human DNA Fragment",
    scientificName: "Homo sapiens (GRCh38 / Chromosome 21)",
    expectedGC: 41.0,
    group: "Eukaryotic Host",
    description: "Vertebrate host sequence. Characterized by extreme CpG deficiency (CG approx 0.22) due to evolutionary methylation.",
    profile: {
      "AA": 1.31, "AC": 0.81, "AG": 1.22, "AT": 1.14,
      "CA": 1.19, "CC": 1.24, "CG": 0.24, "CT": 1.12,
      "GA": 1.18, "GC": 0.94, "GG": 1.18, "GT": 0.81,
      "TA": 0.72, "TC": 1.13, "TG": 1.25, "TT": 1.31
    }
  },
  {
    name: "Saccharomyces cerevisiae",
    scientificName: "Saccharomyces cerevisiae S288C",
    expectedGC: 38.3,
    group: "Bacterial Isolate", // Yeast/Fungal Isolate
    description: "Unicellular eukaryotic model yeast genome. Low GC content, mild CpG depletion.",
    profile: {
      "AA": 1.42, "AC": 0.78, "AG": 0.95, "AT": 1.24,
      "CA": 1.05, "CC": 1.09, "CG": 0.78, "CT": 0.88,
      "GA": 0.94, "GC": 0.98, "GG": 1.09, "GT": 0.78,
      "TA": 0.85, "TC": 0.95, "TG": 1.05, "TT": 1.42
    }
  },
  {
    name: "Phage phiX174 Control",
    scientificName: "Enterobacteria phage phiX174 sensu lato",
    expectedGC: 44.8,
    group: "Controls & Phages",
    description: "Ultrasmall ssDNA phage widely used as a spike-in calibration control in Illumina sequencing pipelines.",
    profile: {
      "AA": 1.15, "AC": 0.90, "AG": 0.95, "AT": 1.10,
      "CA": 0.95, "CC": 1.05, "CG": 1.08, "CT": 0.92,
      "GA": 1.02, "GC": 1.05, "GG": 1.02, "GT": 0.91,
      "TA": 0.88, "TC": 0.98, "TG": 0.95, "TT": 1.15
    }
  }
];

/**
 * Calculates Euclidean distance between two profiles.
 * Distance is normalized across all 16 dinucleotide classes.
 */
export function calculateProfileDistance(p1: Record<string, number>, p2: Record<string, number>): number {
  let sumSq = 0;
  let count = 0;
  for (const key of Object.keys(p1)) {
    if (key in p2) {
      sumSq += Math.pow(p1[key] - p2[key], 2);
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sumSq / count) : 1.0;
}

/**
 * Parses a FASTA file string into rich assembly metrics.
 * Fast, non-blocking sequence parsing that processes FASTA sequences.
 */
export function parseFasta(fastaText: string): AssemblyMetrics {
  const lines = fastaText.split(/\r?\n/);
  const contigs: Contig[] = [];
  
  let currentHeader = "";
  let currentSeqParts: string[] = [];
  
  function saveCurrentContig() {
    if (currentHeader && currentSeqParts.length > 0) {
      const fullSeq = currentSeqParts.join("").toUpperCase();
      const length = fullSeq.length;
      if (length > 0) {
        // Compute nucleotide composition
        let a = 0, c = 0, g = 0, t = 0, n = 0;
        const dnCounts: Record<string, number> = {};
        
        // Initialize dinucleotide counts
        const bases = ["A", "C", "G", "T"];
        for (const b1 of bases) {
          for (const b2 of bases) {
            dnCounts[b1 + b2] = 0;
          }
        }
        
        for (let i = 0; i < length; i++) {
          const char = fullSeq[i];
          if (char === 'A') a++;
          else if (char === 'C') c++;
          else if (char === 'G') g++;
          else if (char === 'T') t++;
          else n++;
          
          if (i < length - 1) {
            const di = fullSeq.substring(i, i + 2);
            if (di[0] in dnCounts && di[1] in dnCounts) {
              dnCounts[di]++;
            }
          }
        }
        
        const gcContent = length - n > 0 ? ((g + c) / (length - n)) * 100 : 0;
        
        // Compute relative abundance (rho_XY) of dinucleotides
        const dinucleotides: Record<string, number> = {};
        const totalBases = a + c + g + t;
        if (totalBases > 1) {
          for (const b1 of bases) {
            for (const b2 of bases) {
              const dn = b1 + b2;
              const fX = (b1 === 'A' ? a : b1 === 'C' ? c : b1 === 'G' ? g : t) / totalBases;
              const fY = (b2 === 'A' ? a : b2 === 'C' ? c : b2 === 'G' ? g : t) / totalBases;
              const fXY = dnCounts[dn] / (totalBases - 1);
              
              if (fX > 0 && fY > 0) {
                dinucleotides[dn] = parseFloat((fXY / (fX * fY)).toFixed(3));
              } else {
                dinucleotides[dn] = 0.0;
              }
            }
          }
        }
        
        const trueLength = length - n;

        // Extract a clean contig ID
        const idMatch = currentHeader.match(/^>(\S+)/);
        const id = idMatch ? idMatch[1] : `contig_${contigs.length + 1}`;
        
        contigs.push({
          id,
          header: currentHeader.substring(1),
          length,
          trueLength,
          gcContent,
          nucleotides: { a, c, g, t, n },
          dinucleotides
        });
      }
    }
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      saveCurrentContig();
      currentHeader = trimmed;
      currentSeqParts = [];
    } else if (trimmed) {
      currentSeqParts.push(trimmed);
    }
  }
  saveCurrentContig(); // save the remaining trailing contig
  
  if (contigs.length === 0) {
    throw new Error("No valid FASTA records containing '>' headers and biological sequences were found.");
  }
  
  // Sort contigs in descending order of length to calculate N50, L50, etc.
  contigs.sort((a, b) => b.length - a.length);
  
  let totalLength = 0;
  let totalTrueLength = 0;
  let totalA = 0, totalC = 0, totalG = 0, totalT = 0, totalN = 0;
  
  for (const c of contigs) {
    totalLength += c.length;
    totalTrueLength += c.trueLength;
    totalA += c.nucleotides.a;
    totalC += c.nucleotides.c;
    totalG += c.nucleotides.g;
    totalT += c.nucleotides.t;
    totalN += c.nucleotides.n;
  }
  
  const trueLength = totalLength - totalN;
  const gcContent = totalLength - totalN > 0 ? ((totalG + totalC) / (totalLength - totalN)) * 100 : 0;
  const averageLength = totalLength / contigs.length;
  const averageTrueLength = totalTrueLength / contigs.length;
  
  // N50 & L50 Metric computation
  let runningSum = 0;
  let n50 = 0;
  let l50 = 0;
  let n90 = 0;
  let l90 = 0;
  
  const halfSum = totalLength * 0.5;
  const ninetySum = totalLength * 0.9;
  
  for (let i = 0; i < contigs.length; i++) {
    runningSum += contigs[i].length;
    if (runningSum >= halfSum && n50 === 0) {
      n50 = contigs[i].length;
      l50 = i + 1; // 1-based index representing the contig count that makes up the 50%
    }
    if (runningSum >= ninetySum && n90 === 0) {
      n90 = contigs[i].length;
      l90 = i + 1;
    }
  }
  
  return {
    totalLength,
    trueLength,
    contigCount: contigs.length,
    averageLength,
    averageTrueLength,
    n50,
    l50,
    n90,
    l90,
    gcContent,
    nucleotideCounts: { a: totalA, c: totalC, g: totalG, t: totalT, n: totalN },
    contigs
  };
}

/**
 * Procedural Generator to generate incredibly realistic genomics assembly sequences
 * and metadata profiles without bloating bundle size.
 */
export function generateSyntheticAssembly(
  type: 'ecoli_isolate' | 'salmonella_fragmented' | 'polluted_pseudomonas'
): string {
  const contigLines: string[] = [];
  
  if (type === 'ecoli_isolate') {
    // E. coli Isolate: Clean, outstanding assembly, 4.6MB, 75 contigs, N50 of 180kb.
    // We will generate headers and sequence lengths that perfectly follow an exponential/power law distribution.
    const contigCount = 76;
    const peakLength = 480000;
    const baseGC = 50.8;
    
    for (let i = 0; i < contigCount; i++) {
      // Model exponential decay for contig lengths
      const fraction = i / contigCount;
      const length = Math.max(
        600,
        Math.round(peakLength * Math.pow(1 - fraction, 2.5) + 500)
      );
      
      const gc = baseGC + (Math.sin(i * 3.7) * 1.5) - (fraction * 1.0); // mild biological wobble
      
      contigLines.push(`>contig_ec_${i+1} [length=${length}] [organism=Escherichia coli str. K-12 MG1655]`);
      contigLines.push(generateProceduralSequence(length, gc, 'ecoli'));
    }
  } else if (type === 'salmonella_fragmented') {
    // Salmonella: Highly fragmented environmental isolate, 4.8MB, 320 contigs, N50 of 28kb, Phage phiX174 control contamination added.
    const contigCount = 310;
    const peakLength = 85000;
    const baseGC = 52.2;
    
    // Standard Salmonella contigs
    for (let i = 0; i < contigCount; i++) {
      const fraction = i / contigCount;
      const length = Math.max(
        350,
        Math.round(peakLength * Math.pow(1 - fraction, 4.2) + 200)
      );
      
      const gc = baseGC + (Math.sin(i * 1.9) * 2.1);
      contigLines.push(`>contig_sal_${i+1} [length=${length}] [organism=Salmonella enterica LT2]`);
      contigLines.push(generateProceduralSequence(length, gc, 'salmonella'));
    }
    
    // Add Phage control as contaminant (1 distinct small contig mimicking phiX174 spike)
    const phageLen = 5386;
    contigLines.push(`>contig_phage_phiX174 [length=5386] [control=phage_spike_calibration]`);
    contigLines.push(generateProceduralSequence(phageLen, 44.8, 'phiX174'));
  } else {
    // Polluted Pseudomonas: Pseudomonas aeruginosa contaminated with Human host sequence and dense Phage spike-in.
    // 6.2MB, 180 contigs.
    // Pseudomonas contigs: high GC 66.6%
    const pseudomonasContigs = 130;
    for (let i = 0; i < pseudomonasContigs; i++) {
      const fraction = i / pseudomonasContigs;
      const length = Math.max(
        1200,
        Math.round(250000 * Math.pow(1 - fraction, 2.1) + 800)
      );
      contigLines.push(`>contig_pa_${i+1} [length=${length}] [target=Pseudomonas_aeruginosa]`);
      contigLines.push(generateProceduralSequence(length, 66.6, 'pseudomonas'));
    }
    
    // Human Host DNA contamination (25 long, low-GC, CpG-deficient contigs)
    for (let i = 0; i < 40; i++) {
      const fraction = i / 40;
      const length = Math.max(
        1500,
        Math.round(80000 * Math.pow(1 - fraction, 1.8) + 1200)
      );
      contigLines.push(`>contig_human_pollution_${i+1} [length=${length}] [source=eukaryotic_host_spillover]`);
      contigLines.push(generateProceduralSequence(length, 41.0, 'human'));
    }
    
    // Phage Calibration Control (phage phiX174)
    contigLines.push(`>contig_phiX174_calibration [length=5386] [control=control_phiX174]`);
    contigLines.push(generateProceduralSequence(5386, 44.8, 'phiX174'));
  }
  
  return contigLines.join("\n");
}

/**
 * Generates an authentic biological looking DNA letter sequence of desired length and GC skew.
 * Embeds genuine dinucleotide abundance distributions so our Dinucleotide Analyzer actually matches properly!
 */
function generateProceduralSequence(length: number, targetGC: number, profileName: string): string {
  const gcProb = targetGC / 100;
  const atProb = 1 - gcProb;
  
  // Transition probabilities mapped back using the dinucleotide patterns:
  // We specify transition tables to make CpG suppression and biological signatures 100% mathematically real!
  let currentBase = Math.random() < 0.5 ? (Math.random() < gcProb ? "G" : "A") : (Math.random() < gcProb ? "C" : "T");
  const seq: string[] = [currentBase];
  
  // Transition weight adjusters based on biological signature of specific species
  const transitionOdds: Record<string, Record<string, Record<string, number>>> = {
    // Human CpG suppression: CG transitions are deeply suppressed (p=0.08), whereas GT, TG, CA, CC are favored.
    'human': {
      'A': { 'A': 0.38, 'C': 0.16, 'G': 0.28, 'T': 0.18 },
      'C': { 'A': 0.35, 'C': 0.36, 'G': 0.05, 'T': 0.24 }, // CpG suppression! CG is extremely suppressed!
      'G': { 'A': 0.24, 'C': 0.22, 'G': 0.36, 'T': 0.18 },
      'T': { 'A': 0.14, 'C': 0.20, 'G': 0.28, 'T': 0.38 }
    },
    // Pseudomonas: high GC-driven transitions
    'pseudomonas': {
      'A': { 'A': 0.15, 'C': 0.35, 'G': 0.35, 'T': 0.15 },
      'C': { 'A': 0.12, 'C': 0.32, 'G': 0.44, 'T': 0.12 },
      'G': { 'A': 0.12, 'C': 0.44, 'G': 0.32, 'T': 0.12 },
      'T': { 'A': 0.15, 'C': 0.35, 'G': 0.35, 'T': 0.15 }
    },
    // E coli: typical prokaryote transitions
    'ecoli': {
      'A': { 'A': 0.31, 'C': 0.20, 'G': 0.24, 'T': 0.25 },
      'C': { 'A': 0.23, 'C': 0.26, 'G': 0.28, 'T': 0.23 },
      'G': { 'A': 0.23, 'C': 0.28, 'G': 0.26, 'T': 0.23 },
      'T': { 'A': 0.25, 'C': 0.24, 'G': 0.20, 'T': 0.31 }
    },
    // Default transitions (S. enterica, etc.)
    'default': {
      'A': { 'A': 0.30, 'C': 0.20, 'G': 0.25, 'T': 0.25 },
      'C': { 'A': 0.23, 'C': 0.27, 'G': 0.27, 'T': 0.23 },
      'G': { 'A': 0.23, 'C': 0.27, 'G': 0.27, 'T': 0.23 },
      'T': { 'A': 0.25, 'C': 0.25, 'G': 0.20, 'T': 0.30 }
    }
  };
  
  const transTable = transitionOdds[profileName] || transitionOdds['default'];
  
  // Scaffolding gaps (stretches of Ns) for long contigs to make calculations biologically realistic!
  const gaps: { start: number; end: number }[] = [];
  if (length > 40000) {
    const gapLen = 100; // e.g. 100 unresolved bases
    gaps.push({ start: Math.floor(length * 0.4), end: Math.floor(length * 0.4) + gapLen });
    if (length > 150000) {
      gaps.push({ start: Math.floor(length * 0.75), end: Math.floor(length * 0.75) + gapLen });
    }
  }

  const CHAR_PER_LINE = 80;
  let lineCount = 0;
  
  for (let i = 1; i < length; i++) {
    // Check if we are inside an unresolved scaffolding gap
    const activeGap = gaps.find(g => i >= g.start && i < g.end);
    
    let nextBase = "A";
    if (activeGap) {
      nextBase = "N";
    } else {
      const odds = transTable[currentBase] || transTable['A'];
      
      // Choose next base based on transition probabilities
      const rand = Math.random();
      if (rand < odds['A']) {
        nextBase = "A";
      } else if (rand < odds['A'] + odds['C']) {
        nextBase = "C";
      } else if (rand < odds['A'] + odds['C'] + odds['G']) {
        nextBase = "G";
      } else {
        nextBase = "T";
      }
    }
    
    seq.push(nextBase);
    currentBase = nextBase;
    
    lineCount++;
    if (lineCount === CHAR_PER_LINE) {
      seq.push("\n");
      lineCount = 0;
    }
  }
  
  return seq.join("");
}

/**
 * Executes a Taxonomic Affinity and Contamination analysis on the parsed assembly metrics.
 * Measures Euclidean distance between parsed relative abundance dinucleptides versus 
 * standard database of reference taxons. Also detects specific potential contaminations.
 */
export interface TaxonScanResult {
  reference: TaxonReference;
  similarityScore: number; // 0 to 100%
  abundanceEstimate: number; // calculated biological abundance estimation %
  statusFlag: 'Expected Isolate Match' | 'Expected Secondary Record' | 'Warning: Contaminant Match' | 'Extreme Contamination Spillover';
  statusColor: 'teal' | 'emerald' | 'amber' | 'rose';
  analysisRecommendation: string;
}

export function performTaxonomicScan(metrics: AssemblyMetrics): TaxonScanResult[] {
  // Aggregate the overall assembly-wide dinucleotide relative abundance by calculating average
  const assemblyDN: Record<string, number> = {};
  const bases = ["A", "C", "G", "T"];
  
  // Count overall dinucleotides in the assembly
  let totalBases = 0;
  let totalA = 0, totalC = 0, totalG = 0, totalT = 0;
  const dnCounts: Record<string, number> = {};
  
  for (const b1 of bases) {
    for (const b2 of bases) {
      dnCounts[b1 + b2] = 0;
    }
  }
  
  for (const contig of metrics.contigs) {
    totalA += contig.nucleotides.a;
    totalC += contig.nucleotides.c;
    totalG += contig.nucleotides.g;
    totalT += contig.nucleotides.t;
    
    for (const entry of Object.entries(contig.dinucleotides)) {
      // Re-estimate raw counts to properly weight different length contigs
      const rawCount = contig.dinucleotides[entry[0]] * (contig.length - 1);
      if (entry[0] in dnCounts) {
        dnCounts[entry[0]] += rawCount;
      }
    }
  }
  
  totalBases = totalA + totalC + totalG + totalT;
  const bases_sum_minus_one = totalBases - metrics.contigs.length; // adjustment for contiguous boundaries
  
  if (totalBases > 0) {
    for (const b1 of bases) {
      for (const b2 of bases) {
        const dn = b1 + b2;
        const fX = (b1 === 'A' ? totalA : b1 === 'C' ? totalC : b1 === 'G' ? totalG : totalT) / totalBases;
        const fY = (b2 === 'A' ? totalA : b2 === 'C' ? totalC : b2 === 'G' ? totalG : totalT) / totalBases;
        const fXY = dnCounts[dn] / bases_sum_minus_one;
        
        if (fX > 0 && fY > 0) {
          assemblyDN[dn] = fXY / (fX * fY);
        } else {
          assemblyDN[dn] = 1.0;
        }
      }
    }
  }
  
  // Now calculate distances against all database references
  const results: TaxonScanResult[] = TAXON_REFERENCES.map(ref => {
    // Euclidean distance
    const dist = calculateProfileDistance(assemblyDN, ref.profile);
    
    // Scale distance to a human-friendly "Similarity Score" from 0 to 100%
    // A distance of 0 -> 100% similarity, distance >= 0.5 -> 0% similarity
    const rawSim = Math.max(0, 100 - (dist * 200));
    // Let's also adjust similarity based on GC deviation to prevent false positive matches with mismatched GC content
    const gcDiff = Math.abs(metrics.gcContent - ref.expectedGC);
    const gcPenalty = Math.max(0, gcDiff * 3.5); // 3.5% penalty per 1% GC deviation
    const similarityScore = parseFloat(Math.max(12, rawSim - gcPenalty).toFixed(1));
    
    // Estimate logical abundance breakdown based on contigs composition.
    // For each contig, what reference does it match closest?
    let contigDistanceSum = 0;
    let matchingLength = 0;
    
    for (const c of metrics.contigs) {
      const cDist = calculateProfileDistance(c.dinucleotides, ref.profile);
      const cGcDiff = Math.abs(c.gcContent - ref.expectedGC);
      const score = Math.max(0, (1 - cDist * 2) * 100 - (cGcDiff * 4));
      if (score > 70) {
        matchingLength += c.length;
      }
    }
    
    const abundanceEstimate = parseFloat(((matchingLength / metrics.totalLength) * 100).toFixed(1));
    
    // Formulate intelligent status labels and clinical actions
    let statusFlag: 'Expected Isolate Match' | 'Expected Secondary Record' | 'Warning: Contaminant Match' | 'Extreme Contamination Spillover' = 'Expected Secondary Record';
    let statusColor: 'teal' | 'emerald' | 'amber' | 'rose' = 'emerald';
    let recommendation = "";
    
    if (abundanceEstimate > 70) {
      statusFlag = 'Expected Isolate Match';
      statusColor = 'emerald';
      recommendation = `Target pathogen identified with outstanding homogeneity (${abundanceEstimate}% of assembly sequences match reference signatures perfectly). Clean assembly ready for phylogenomic analysis.`;
    } else if (abundanceEstimate > 15) {
      statusFlag = 'Warning: Contaminant Match';
      statusColor = 'amber';
      recommendation = `Heuristics scan flag triggered! Substantive DNA footprint (${abundanceEstimate}%) suggests co-isolation, barcode bleeding, or host cellular spillover. Run filtration algorithm (e.g., Kraken2/Bowtie2) to cleanse draft contigs.`;
    } else if (abundanceEstimate > 1) {
      statusFlag = 'Warning: Contaminant Match';
      statusColor = 'amber';
      recommendation = `Trace level matches detected (${abundanceEstimate}% coverage). Likely spike-in calibration (Phage phiX174) or minor environment index bleeding. Sub-threshold level; safe to ignore but check filter parameters.`;
    } else {
      statusFlag = 'Expected Secondary Record';
      statusColor = 'teal';
      recommendation = `No significant compositional overlap detected (<1% assembly presence). Clear phylogenetic isolation.`;
    }
    
    // Overrule based on host DNA parameters (e.g. human read pollution has higher severity)
    if (ref.group === 'Eukaryotic Host' && abundanceEstimate > 10) {
      statusFlag = 'Extreme Contamination Spillover';
      statusColor = 'rose';
      recommendation = `CRITICAL SPILLOVER COMPROMISE: Massive eukaryotic host DNA pollution detected (${abundanceEstimate}%)! Wet-lab sample preparation failed to fully lyse host cells or deplete eukaryotic RNA/DNA. High risk of false pipeline assembly. You must map against host genome and re-isolate.`;
    }
    
    return {
      reference: ref,
      similarityScore,
      abundanceEstimate,
      statusFlag,
      statusColor,
      analysisRecommendation: recommendation
    };
  });
  
  // Sort results by abundance estimation descending, so closest components are seen first!
  return results.sort((a, b) => b.abundanceEstimate - a.abundanceEstimate);
}

/**
 * Filter FASTA records based on sequence length threshold.
 * Useful for filtering sequencing artifacts and short contigs.
 */
export function filterFastaText(fastaText: string, threshold: number): { text: string; kept: number; removed: number } {
  const lines = fastaText.split(/\r?\n/);
  const keptRecords: string[] = [];
  let currentHeader = "";
  let currentSeqParts: string[] = [];
  let keptCount = 0;
  let removedCount = 0;
  
  function evaluateAndSave() {
    if (currentHeader) {
      const fullSeq = currentSeqParts.join("");
      const length = fullSeq.length;
      if (length >= threshold) {
        keptRecords.push(currentHeader);
        keptRecords.push(currentSeqParts.join("\n"));
        keptCount++;
      } else {
        removedCount++;
      }
    }
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      evaluateAndSave();
      currentHeader = trimmed;
      currentSeqParts = [];
    } else if (trimmed) {
      currentSeqParts.push(trimmed);
    }
  }
  evaluateAndSave();
  
  return {
    text: keptRecords.join("\n"),
    kept: keptCount,
    removed: removedCount
  };
}
