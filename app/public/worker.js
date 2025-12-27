// public/worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

let pyodide;

async function loadEngine() {
    try {
        console.log("Worker: Starting Pyodide load...");
        pyodide = await loadPyodide();

        console.log("Worker: Loading Python packages (numpy, pandas)...");
        await pyodide.loadPackage(['numpy', 'pandas', 'python-dateutil']);

        console.log("Worker: Fetching analysis.py...");
        const response = await fetch('/analysis.py');
        if (!response.ok) throw new Error(`Failed to fetch analysis.py: ${response.statusText}`);

        const pythonCode = await response.text();

        console.log("Worker: Executing analysis.py in Pyodide...");
        await pyodide.runPythonAsync(pythonCode);

        console.log("Worker: Pyodide is READY");
        self.postMessage({ type: 'READY' });
    } catch (err) {
        console.error("Worker: Initialization Error:", err);
        self.postMessage({ type: 'ERROR', error: `Init Error: ${err.message}` });
    }
}

self.onmessage = async (e) => {
    const { gpxString, params } = e.data;
    console.log("Worker: Message received", { params });

    if (!pyodide) {
        console.error("Worker: Received message before Pyodide was ready!");
        self.postMessage({ type: 'ERROR', error: "Worker not ready" });
        return;
    }

    try {
        console.log("Worker: Locating run_analysis function...");
        const runAnalysis = pyodide.globals.get('run_analysis');

        if (!runAnalysis) throw new Error("function 'run_analysis' not found in analysis.py");

        console.log("Worker: Running Python analysis...");
        const pythonResult = runAnalysis(gpxString, pyodide.toPy(params));

        console.log("Worker: Analysis successful, sending results back.");
        const jsResult = pythonResult.toJs({ dict_converter: Object.fromEntries });

        self.postMessage({ type: 'RESULT', data: jsResult });
    } catch (err) {
        console.error("Worker: Runtime Error:", err);
        self.postMessage({ type: 'ERROR', error: `Python Error: ${err.message}` });
    }
};

loadEngine();