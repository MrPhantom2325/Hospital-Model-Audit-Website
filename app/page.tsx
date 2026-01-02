"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { AlertCircle, FileJson } from "lucide-react"

export default function ModelAuditPage() {
  const [inputMode, setInputMode] = useState<"manual" | "json">("manual")
  const [metrics, setMetrics] = useState({
    auc: "",
    accuracy: "",
    precision: "",
    recall: "",
    f1Score: "",
    ece: "",
    brier: "",
    drift: "",
    missingRate: "",
    labelShift: "",
    positiveRate: "",
    dataIntegrity: "",
  })
  const [jsonError, setJsonError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [modelOutput, setModelOutput] = useState<{ label: string; explanation: string } | null>({
    label: "Major Drift",
    explanation: "A significant label distribution shift has been detected in the model's predictions compared to the training distribution. This indicates that the model is encountering data with substantially different label proportions than what it was trained on.\n\nKey indicators of this drift include:\n- Label distribution mismatch: The observed label frequencies deviate significantly from the expected training distribution\n- Performance degradation: Model accuracy and reliability may be compromised due to distribution shift\n- Data quality concerns: This drift suggests potential issues with data collection, preprocessing, or changes in the underlying data generation process\n\nRecommended actions:\n1. Investigate the source of the distribution shift in your input data\n2. Retrain or fine-tune the model on more recent, representative data\n3. Implement data validation checks to catch distribution shifts early\n4. Consider using domain adaptation techniques to improve model robustness\n5. Monitor label distributions continuously to detect future shifts proactively\n\nThis is a critical issue that requires immediate attention to maintain model performance and reliability."
  })
  const [apiError, setApiError] = useState("")
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")

  // Check backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout for health check
        
        const response = await fetch(`${apiUrl}/health`, {
          method: "GET",
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          setBackendStatus("online")
          setApiError("")
        } else {
          setBackendStatus("offline")
        }
      } catch (error) {
        setBackendStatus("offline")
        // Don't set apiError here, just update status
      }
    }
    
    checkBackend()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setMetrics((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        setMetrics({
          auc: json.auc?.toString() || "",
          accuracy: json.accuracy?.toString() || "",
          precision: json.precision?.toString() || "",
          recall: json.recall?.toString() || "",
          f1Score: json.f1Score?.toString() || "",
          ece: json.ece?.toString() || "",
          brier: json.brier?.toString() || "",
          drift: json.drift?.toString() || "",
          missingRate: json.missingRate?.toString() || "",
          labelShift: json.labelShift?.toString() || "",
          positiveRate: json.positiveRate?.toString() || "",
          dataIntegrity: json.dataIntegrity?.toString() || "",
        })
        setJsonError("")
        setInputMode("manual")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid JSON file. Please check the format."
        setJsonError(errorMessage)
      }
    }
    reader.onerror = () => {
      setJsonError("Error reading file. Please try again.")
    }
    reader.readAsText(file)
  }

  const handleRunModel = async () => {
    setIsLoading(true)
    setApiError("")
    setModelOutput(null)

    try {
      // Prepare metrics data
      const metricsData: Record<string, number> = {}
      
      // Convert string values to numbers, only include non-empty values
      Object.entries(metrics).forEach(([key, value]) => {
        if (value && value.trim() !== "") {
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            metricsData[key] = numValue
          }
        }
      })

      // Check if we have at least one metric
      if (Object.keys(metricsData).length === 0) {
        setApiError("Please provide at least one metric value")
        setIsLoading(false)
        return
      }

      // Call the API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      
      // Create AbortController for timeout
      // Increased timeout to 5 minutes to account for model loading and generation time
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout (300 seconds)
      
      try {
        const response = await fetch(`${apiUrl}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metricsData),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        setModelOutput({
          label: result.label || "Needs Review",
          explanation: result.explanation || "Analysis completed.",
        })
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error("Error calling API:", error)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      
      let errorMessage = "Failed to connect to the backend server."
      
      if (error instanceof Error) {
        // Check for specific error types
        if (error.name === "AbortError" || error.message.includes("aborted")) {
          errorMessage = "Request timed out after 5 minutes. This can happen if:\n1. The model is still loading (first request takes longer)\n2. The model generation is taking longer than expected\n3. The server may be processing a large request\n\nPlease wait a moment and try again, or check the backend server logs."
        } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("ERR_")) {
          errorMessage = `Cannot connect to backend server at ${apiUrl}. Please ensure:\n1. The backend server is running (python3 main.py in the backend directory)\n2. The server is accessible at ${apiUrl}\n3. There are no firewall or network restrictions`
        } else if (error.message.includes("CORS")) {
          errorMessage = "CORS error: The backend server is not allowing requests from this origin."
        } else {
          errorMessage = error.message
        }
      }
      
      setApiError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, mode: "manual" | "json") => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setInputMode(mode)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Backend Status Indicator */}
        {backendStatus === "offline" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">Backend Server Not Connected</h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                Cannot reach the backend server at {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}. 
                Please ensure the backend is running by executing: <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">cd backend && python3 main.py</code>
              </p>
            </div>
          </div>
        )}
        {backendStatus === "checking" && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full animate-spin"></span>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">Checking backend connection...</p>
          </div>
        )}
        
        <div className="mb-12 px-8 py-16 rounded-3xl bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 text-white shadow-2xl shadow-orange-400/40 transform transition-all duration-300 hover:shadow-orange-400/60 hover:scale-[1.01]">
          <div className="text-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-orange-100 drop-shadow-lg">
              MODEL AUDIT TESTING
            </h1>
            <p className="text-xl text-orange-50 max-w-2xl mx-auto leading-relaxed font-medium">
              Input your model metrics and test them with your model to analyze and print output.
            </p>
          </div>
        </div>

        {/* Main Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Card - Input Metrics */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-8 transform transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-1">
            <div className="flex gap-4 mb-8 border-b-2 border-slate-200 dark:border-slate-800" role="tablist" aria-label="Input method selection">
              <button
                type="button"
                onClick={() => setInputMode("manual")}
                onKeyDown={(e) => handleTabKeyDown(e, "manual")}
                role="tab"
                aria-selected={inputMode === "manual"}
                aria-controls="manual-input-panel"
                id="manual-tab"
                className={`px-6 py-3 font-semibold transition-all duration-300 relative ${
                  inputMode === "manual"
                    ? "text-orange-600 dark:text-orange-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Manual Input
                {inputMode === "manual" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setInputMode("json")}
                onKeyDown={(e) => handleTabKeyDown(e, "json")}
                role="tab"
                aria-selected={inputMode === "json"}
                aria-controls="json-input-panel"
                id="json-tab"
                className={`px-6 py-3 font-semibold transition-all duration-300 relative ${
                  inputMode === "json"
                    ? "text-orange-600 dark:text-orange-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Upload JSON
                {inputMode === "json" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"></span>
                )}
              </button>
            </div>

            {inputMode === "manual" ? (
              <div id="manual-input-panel" role="tabpanel" aria-labelledby="manual-tab" className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Input Metrics
                </h2>

                <form onSubmit={(e) => { e.preventDefault(); handleRunModel(); }} className="space-y-5">
                  {/* AUC */}
                  <div className="group">
                    <label htmlFor="auc-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">AUC</label>
                    <input
                      id="auc-input"
                      name="auc"
                      type="number"
                      placeholder="e.g. 0.8523"
                      value={metrics.auc}
                      onChange={(e) => handleInputChange("auc", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Accuracy */}
                  <div className="group">
                    <label htmlFor="accuracy-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Accuracy</label>
                    <input
                      id="accuracy-input"
                      name="accuracy"
                      type="number"
                      placeholder="e.g. 0.7865"
                      value={metrics.accuracy}
                      onChange={(e) => handleInputChange("accuracy", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Precision */}
                  <div className="group">
                    <label htmlFor="precision-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Precision</label>
                    <input
                      id="precision-input"
                      name="precision"
                      type="number"
                      placeholder="e.g. 0.8234"
                      value={metrics.precision}
                      onChange={(e) => handleInputChange("precision", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Recall */}
                  <div className="group">
                    <label htmlFor="recall-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Recall</label>
                    <input
                      id="recall-input"
                      name="recall"
                      type="number"
                      placeholder="e.g. 0.7432"
                      value={metrics.recall}
                      onChange={(e) => handleInputChange("recall", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* F1 Score */}
                  <div className="group">
                    <label htmlFor="f1Score-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">F1 Score</label>
                    <input
                      id="f1Score-input"
                      name="f1Score"
                      type="number"
                      placeholder="e.g. 0.7823"
                      value={metrics.f1Score}
                      onChange={(e) => handleInputChange("f1Score", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* ECE */}
                  <div className="group">
                    <label htmlFor="ece-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">ECE</label>
                    <input
                      id="ece-input"
                      name="ece"
                      type="number"
                      placeholder="e.g. 0.0452"
                      value={metrics.ece}
                      onChange={(e) => handleInputChange("ece", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Brier */}
                  <div className="group">
                    <label htmlFor="brier-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Brier</label>
                    <input
                      id="brier-input"
                      name="brier"
                      type="number"
                      placeholder="e.g. 0.1234"
                      value={metrics.brier}
                      onChange={(e) => handleInputChange("brier", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Drift */}
                  <div className="group">
                    <label htmlFor="drift-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Drift</label>
                    <input
                      id="drift-input"
                      name="drift"
                      type="number"
                      placeholder="e.g. 0.0523"
                      value={metrics.drift}
                      onChange={(e) => handleInputChange("drift", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      aria-required="false"
                    />
                  </div>

                  {/* Missing Rate */}
                  <div className="group">
                    <label htmlFor="missingRate-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Missing Rate</label>
                    <input
                      id="missingRate-input"
                      name="missingRate"
                      type="number"
                      placeholder="e.g. 0.0145"
                      value={metrics.missingRate}
                      onChange={(e) => handleInputChange("missingRate", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Label Shift */}
                  <div className="group">
                    <label htmlFor="labelShift-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Label Shift</label>
                    <input
                      id="labelShift-input"
                      name="labelShift"
                      type="number"
                      placeholder="e.g. 0.0832"
                      value={metrics.labelShift}
                      onChange={(e) => handleInputChange("labelShift", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      aria-required="false"
                    />
                  </div>

                  {/* Positive Rate */}
                  <div className="group">
                    <label htmlFor="positiveRate-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Positive Rate</label>
                    <input
                      id="positiveRate-input"
                      name="positiveRate"
                      type="number"
                      placeholder="e.g. 0.4521"
                      value={metrics.positiveRate}
                      onChange={(e) => handleInputChange("positiveRate", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="0.0001"
                      min="0"
                      max="1"
                      aria-required="false"
                    />
                  </div>

                  {/* Data Integrity Issues */}
                  <div className="group">
                    <label htmlFor="dataIntegrity-input" className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Data Integrity Issues</label>
                    <input
                      id="dataIntegrity-input"
                      name="dataIntegrity"
                      type="number"
                      placeholder="e.g. 2"
                      value={metrics.dataIntegrity}
                      onChange={(e) => handleInputChange("dataIntegrity", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50 text-foreground transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 hover:border-slate-300 dark:hover:border-slate-600"
                      step="1"
                      min="0"
                      aria-required="false"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isLoading}
                    aria-label="Run model with input metrics"
                    className="w-full mt-10 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-orange-400/40 hover:shadow-xl hover:shadow-orange-500/50 transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Processing...
                      </span>
                    ) : (
                      "RUN MODEL"
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div id="json-input-panel" role="tabpanel" aria-labelledby="json-tab" className="animate-in fade-in slide-in-from-left-4 duration-500">
                <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Upload JSON File
                </h2>

                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-orange-100/30 dark:hover:from-orange-900/20 dark:hover:to-orange-800/10 transition-all duration-300 cursor-pointer group">
                  <label 
                    htmlFor="json-file-input"
                    className="flex flex-col items-center gap-4 cursor-pointer w-full"
                    aria-label="Upload JSON file with model metrics"
                  >
                    <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-2xl group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-all duration-300 group-hover:scale-110">
                      <FileJson className="w-16 h-16 text-orange-600 dark:text-orange-500" aria-hidden="true" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg text-slate-800 dark:text-slate-200">Drop your JSON file here</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">or click to browse</p>
                    </div>
                    <input 
                      id="json-file-input"
                      name="jsonFile"
                      type="file" 
                      accept=".json" 
                      onChange={handleJsonUpload} 
                      className="hidden"
                      aria-describedby="json-format-help json-error-message"
                    />
                  </label>
                </div>

                {jsonError && (
                  <div 
                    id="json-error-message"
                    role="alert"
                    aria-live="polite"
                    className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex gap-3 animate-in slide-in-from-top-2 duration-300"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">{jsonError}</p>
                  </div>
                )}

                <p id="json-format-help" className="mt-8 text-sm font-semibold text-slate-600 dark:text-slate-400 text-center">Expected JSON format:</p>
                <pre className="mt-4 p-5 bg-slate-900 dark:bg-slate-950 rounded-xl text-xs text-slate-100 overflow-auto border border-slate-800 shadow-inner" aria-label="JSON format example">
                  {`{
    "auc": 0.8523,
    "accuracy": 0.7865,
    "precision": 0.8234,
    "recall": 0.7432,
    "f1Score": 0.7823,
    "ece": 0.0452,
    "brier": 0.1234,
    "drift": 0.0523,
    "missingRate": 0.0145,
    "labelShift": 0.0832,
    "positiveRate": 0.4521,
    "dataIntegrity": 2
}`}
                </pre>

                <button 
                  type="button"
                  onClick={handleRunModel}
                  disabled={isLoading}
                  aria-label="Run model with uploaded JSON file"
                  className="w-full mt-10 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-orange-400/40 hover:shadow-xl hover:shadow-orange-500/50 transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Processing...
                    </span>
                  ) : (
                    "RUN MODEL"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Card - Model Output */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 p-8 transform transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-1">
            <h2 className="text-3xl font-bold mb-10 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Model Output
            </h2>

            <div className="space-y-6">
              {isLoading ? (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center justify-center min-h-[200px]">
                  <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Analyzing metrics...</p>
                </div>
              ) : apiError ? (
                <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 shadow-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Error</h3>
                      <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
                    </div>
                  </div>
                </div>
              ) : modelOutput ? (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-orange-50 via-orange-100/50 to-amber-50 dark:from-orange-950/30 dark:via-orange-900/20 dark:to-amber-950/30 border-2 border-orange-200/50 dark:border-orange-800/50 shadow-lg relative overflow-hidden animate-in fade-in duration-500">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-400/20 rounded-full blur-xl -ml-12 -mb-12"></div>
                  <div className="relative">
                    <h3 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-orange-600 to-orange-700 dark:from-orange-400 dark:to-orange-500 bg-clip-text text-transparent">
                      {modelOutput.label}
                    </h3>
                    <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {modelOutput.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    <p className="text-lg font-medium">No analysis yet</p>
                    <p className="text-sm mt-2">Enter metrics and click "RUN MODEL" to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
