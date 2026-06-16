# ContigVision: De novo Assembly and Contig Visualizer

**ContigVision** is a high-performance, responsive Single Page Application (SPA) designed for bioinformaticians and wet-lab researchers to upload, parse, analyze, and audit consensus draft genome assemblies (`.fasta`, `.fa`) or raw contigs.

It runs a real-time, sandboxed biological math engine entirely in the client, enabling instant diagnostic scans for eukaryotic host contamination, phage adapter/spike-in carryovers (e.g., phiX174), GC skew, and structural contiguity metrics without sending genomic data to any external server.

---

## 🔬 Mathematical & Biological Core Metrics

The bioinformatic engine behind ContigVision evaluates sequences under IUPAC nucleotide and NCBI submission guidelines. It computes several standard assembly stats:

### 1. de novo Scaffolding Contiguity (N50, L50, N90, L90)
These values assess the quality and scaffolding length of a *de novo* genome assembly:
*   **Total Assembly Size ($G$)**: The cumulative sum of all parsed nucleotide base pairs (bp).
*   **N50 Length**: If all assembled contigs are sorted in descending order of size, the $N50$ is the length of the shortest contig in the subset that, when summed, represents at least 50% of the total assembly size ($G$).
*   **L50 Count**: The minimum number of contigs that, when summed, make up at least 50% of the total assembly size ($G$). (Lower is better, indicating standard chromosome-level scaffolding).
*   **N90 / L90**: Calculated similarly but using a 90% cumulative baseline to describe the assembly tail and highly fragmented smaller contigs.

### 2. Dinucleotide Relative Abundance ($\rho_{XY}$)
Dinucleotide relative abundance measures the frequency of consecutive nucleotide pairs normalized against the background frequency of individual bases. It is defined mathematically as:

$$\rho_{XY} = \frac{f(XY)}{f(X) \times f(Y)}$$

Where:
*   $f(XY)$ is the frequency of the dinucleotide $XY$ sequence-wide.
*   $f(X)$ and $f(Y)$ are the individual frequencies of nucleotides $X$ and $Y$.
*   A value of $\rho_{XY} = 1$ indicates that the dinucleotide occurs exactly at its random neutral expectation. Deviances from $1.0$ indicate evolutionary constraints (such as transcription factors, structural curvature, or codon selection).

### 3. CpG Suppression & Vertebrate Host Contamination Detection
Vertebrate host genomes, including the human genome, suffer from severe **CpG suppression**. Due to evolutionary deamination of methylated cytosines in the $5'\text{-CG-}3'$ position over millions of years:
*   **Human / Mammalian DNA** displays an extreme CpG depletion marker ($\rho_{\text{CG}} \approx 0.22 \text{ to } 0.25$).
*   **Bacterial/Archaeal Genomes** (e.g., *E. coli*, *P. aeruginosa*) lack this structural methylation methylation-deamination loop, sustaining $\rho_{\text{CG}} \approx 1.0 \text{ to } 1.3$.
*   ContigVision calculates $\rho_{\text{CG}}$ over every contig and alerts researchers to eukaryotic genomic carryovers immediately.

---

## 🌟 Key Application Features

### 1. Real-time Multi-Tab Dashboard
*   **Dashboard View**: High-level bento-style cards containing active assembly metrics (N50, L50, average contig length, total bases, GC bias skew, unresolved N-base warnings).
*   **Taxonomic Affinity Tab**: Euclidean alignment matrix matching the sample’s relative dinucleotide abundance against real biological control profiles (*E. coli*, *S. enterica*, *P. aeruginosa*, *S. cerevisiae*, human host, and Phage phiX174).
*   **Assembly Explorer Tab**: Full searchable tabular listing of all parsed contigs. Search by partial FASTA headers, sort by GC content or size, and drill down to inspect nucleotide distributions inside individual contigs.
*   **About & Metric Standards**: Biological documentation and mathematical formulations explaining standard IUPAC and NCBI rules.

### 2. Interactive Charts (with Recharts)
*   **Scatter Plot Matrix**: Graphing GC content (%) against Contig Length (bp) on an optional log-scale axis to pinpoint low-GC or high-GC contaminant contigs.
*   **Base Frequency Histogram**: Distribution bar chart dividing the contigs into equal size cohorts to evaluate assembly sequence consistency.

### 3. Integrated Wet-Lab Presets & Drag-and-Drop Parser
*   **Pre-installed Presets**: Instantly load high-fidelity generated models of *E. coli* isolate, fragmented *Salmonella* multi-contig draft, or a highly skewed *Pseudomonas* pathogen genome.
*   **Custom drag-and-drop**: Drag any standard `.fasta` or `.fa` file right into the dropzone to process custom biological datasets locally.

---

## 🛠️ Technology Stack

*   **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Build Bundler**: [Vite 6](https://vite.dev/)
*   **Style Engine**: [Tailwind CSS v4](https://tailwindcss.com/) (using native high-performance `@tailwindcss/vite` integration)
*   **Animations**: [Motion](https://motion.dev/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Visualization**: [Recharts](https://recharts.org/)

---

## 💻 Local Development Setup

### Direct Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (version 18 or newer) and `npm` installed.

1.  **Clone or Open the Project Working Directory**:
    ```bash
    cd <project-root>
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Launch the development server**:
    ```bash
    npm run dev
    ```
    The server will boot and serve the visual workspace on `http://localhost:3000`.

4.  **Production Build**:
    To compile the optimized, production-ready static assets into the `dist/` folder:
    ```bash
    npm run build
    ```

5.  **Type-checking and Linting**:
    To perform strict TypeScript compilation audits and static code validations:
    ```bash
    npm run lint
    ```

---

## 📂 Project Architecture

```
/
├── src/
│   ├── App.tsx          # Main React Application entry, theme handlers, and Layout views
│   ├── bioUtils.ts      # Core mathematical algorithms, FASTA parser, and profile definitions
│   ├── index.css        # Global CSS stylesheet importing Tailwind CSS v4 variables
│   └── main.tsx         # Virtual DOM renderer mounting the root element
├── index.html           # Document template and entry-point scripts
├── vite.config.ts       # Vite bundler, React, and Tailwind CSS configuration
├── package.json         # Development and production dependencies
└── tsconfig.json        # TypeScript compile specifications and strict types configuration
```

---

*This application is fully compliant with biological sequence standards and NCBI packaging formats.*

