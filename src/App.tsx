import React, { useState } from 'react';
import { Upload, Database, Search, Table2, ArrowRight, AlertCircle, Info } from 'lucide-react';

interface TableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
    constraints?: string[];
  }[];
}

interface AnalysisResult {
  relevantTables: TableSchema[];
  query: string;
  confidence: number;
  matchDetails?: {
    tableMatches: { [key: string]: number };
    columnMatches: { [key: string]: string[] };
  };
}

function App() {
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      setError('Please upload a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (!Array.isArray(content)) {
          throw new Error('Schema must be an array of tables');
        }
        setSchema(content);
        setError(null);
      } catch (error) {
        setError('Invalid JSON format. Please check your file structure');
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.createElement('input');
      input.type = 'file';
      input.files = e.dataTransfer.files;
      const event = { target: input } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(event);
    }
  };

  const calculateRelevanceScore = (
    table: TableSchema,
    queryWords: string[],
    commonWords: Set<string>
  ) => {
    // Remove common words from consideration
    const relevantQueryWords = queryWords.filter(word => !commonWords.has(word));
    
    // Calculate table name match score
    const tableNameWords = table.name.toLowerCase().split(/[_\s]+/);
    const tableNameScore = tableNameWords.reduce((score, tableWord) => {
      return score + (relevantQueryWords.some(queryWord => 
        tableWord.includes(queryWord) || queryWord.includes(tableWord)
      ) ? 1 : 0);
    }, 0);

    // Calculate column match score with weighted importance
    const columnMatches: string[] = [];
    const columnScore = table.columns.reduce((score, column) => {
      const columnWords = column.name.toLowerCase().split(/[_\s]+/);
      const matches = relevantQueryWords.some(queryWord => 
        columnWords.some(columnWord => 
          columnWord.includes(queryWord) || queryWord.includes(columnWord)
        )
      );
      
      if (matches) {
        columnMatches.push(column.name);
        return score + 0.5;
      }
      return score;
    }, 0);

    // Calculate semantic relevance (e.g., if query mentions "user" and table is "customers")
    const semanticScore = calculateSemanticScore(table, relevantQueryWords);

    return {
      total: tableNameScore + columnScore + semanticScore,
      columnMatches,
    };
  };

  const calculateSemanticScore = (table: TableSchema, queryWords: string[]) => {
    const semanticMappings: { [key: string]: string[] } = {
      user: ['customer', 'client', 'person', 'account'],
      customer: ['user', 'client', 'buyer', 'consumer'],
      order: ['purchase', 'transaction', 'sale'],
      product: ['item', 'goods', 'merchandise'],
      payment: ['transaction', 'purchase', 'sale'],
    };

    let score = 0;
    queryWords.forEach(queryWord => {
      const relatedTerms = semanticMappings[queryWord] || [];
      if (relatedTerms.some(term => 
        table.name.toLowerCase().includes(term) ||
        table.columns.some(col => col.name.toLowerCase().includes(term))
      )) {
        score += 0.3; // Lower weight for semantic matches
      }
    });

    return score;
  };

  const analyzeQuery = () => {
    if (!query.trim() || schema.length === 0) return;
    
    setLoading(true);
    
    // Simulating analysis process with improved relevance scoring
    setTimeout(() => {
      const queryWords = query.toLowerCase()
        .replace(/[.,?!]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 1); // Filter out single-character words

      // Common words to ignore in matching
      const commonWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
        'all', 'find', 'get', 'show', 'list', 'display', 'where', 'which'
      ]);

      const tableScores = schema.map(table => {
        const { total, columnMatches } = calculateRelevanceScore(table, queryWords, commonWords);
        return {
          table,
          score: total,
          columnMatches
        };
      });

      // Filter and sort tables by relevance
      const relevantTables = tableScores
        .filter(result => result.score > 0.5) // Increased threshold for better accuracy
        .sort((a, b) => b.score - a.score)
        .map(result => result.table);

      // Calculate match details for debugging and transparency
      const matchDetails = {
        tableMatches: Object.fromEntries(
          tableScores.map(({ table, score }) => [table.name, score])
        ),
        columnMatches: Object.fromEntries(
          tableScores.map(({ table, columnMatches }) => [table.name, columnMatches])
        )
      };

      // Calculate confidence based on match quality
      const confidence = relevantTables.length > 0
        ? Math.min(1, tableScores[0].score / 2) // Normalize confidence
        : 0;

      setResult({
        relevantTables,
        query,
        confidence,
        matchDetails
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Schema Analyzer</h1>
          <p className="text-gray-300 text-lg">Upload your database schema and analyze it with natural language queries</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="text-pink-400" />
              <h2 className="text-2xl font-semibold text-white">Schema Upload</h2>
            </div>
            <label 
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                isDragging 
                  ? 'border-pink-400 bg-pink-400/10' 
                  : 'border-gray-300 bg-white/5 hover:bg-white/10'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className={`mb-2 ${isDragging ? 'text-pink-400' : 'text-gray-300'}`} />
                <p className="text-sm text-gray-300">
                  Drag and drop your JSON file here or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Example format: [{'{'}name: "users", columns: [{'{'}name: "id", type: "uuid"{'}'}]{'}'}]
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".json,application/json" 
                onChange={handleFileUpload}
              />
            </label>
            
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="text-red-400" size={20} />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}
            
            {schema.length > 0 && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                <p className="text-green-400">✓ Schema loaded successfully ({schema.length} tables)</p>
              </div>
            )}
          </div>

          {/* Query Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Search className="text-pink-400" />
              <h2 className="text-2xl font-semibold text-white">Natural Language Query</h2>
            </div>
            <div className="space-y-4">
              <textarea
                className="w-full h-32 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Enter your query (e.g., 'Find all orders with customer information')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="w-full py-2 px-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                onClick={analyzeQuery}
                disabled={!query.trim() || schema.length === 0 || loading}
              >
                {loading ? 'Analyzing...' : 'Analyze Query'}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Table2 className="text-pink-400" />
              <h2 className="text-2xl font-semibold text-white">Analysis Results</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="font-medium">Query:</span>
                <span>{result.query}</span>
              </div>

              {result.relevantTables.length === 0 ? (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 flex items-start gap-3">
                  <Info className="text-blue-400 mt-1" size={20} />
                  <div>
                    <p className="text-blue-200">No matching tables found for your query.</p>
                    <p className="text-blue-300 text-sm mt-1">
                      Try using more specific terms related to your tables or check if the required tables are included in your schema.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">
                      Matching Tables ({result.relevantTables.length})
                    </h3>
                    <span className={`text-sm ${
                      result.confidence > 0.7 ? 'text-green-400' : 
                      result.confidence > 0.4 ? 'text-yellow-400' : 
                      'text-red-400'
                    }`}>
                      Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  {result.relevantTables.map((table, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowRight className="text-pink-400" size={16} />
                        <h4 className="text-lg font-medium text-white">{table.name}</h4>
                        <span className="text-xs text-gray-400">
                          (Match Score: {Math.round(result.matchDetails?.tableMatches[table.name] * 100)}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-gray-300">
                        {table.columns.map((column, colIndex) => {
                          const isMatched = result.matchDetails?.columnMatches[table.name]?.includes(column.name);
                          return (
                            <div 
                              key={colIndex} 
                              className={`bg-white/5 rounded p-2 ${
                                isMatched ? 'ring-1 ring-pink-400/50' : ''
                              }`}
                            >
                              <span className="font-medium">{column.name}</span>
                              <span className="text-pink-400 ml-2">{column.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;