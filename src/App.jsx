import { useState, useEffect } from 'react'
import { ResponsiveSankey } from '@nivo/sankey'
import Papa from 'papaparse'

function App() {
  const [matrices, setMatrices] = useState({
    skills: null,
    ability: null,
    age: null,
    income: null,
    gender: null
  })
  const [weights, setWeights] = useState({
    skills: 0.2,
    ability: 0.2,
    age: 0.2,
    income: 0.2,
    gender: 0.2
  })
  const [selectedJob, setSelectedJob] = useState('')
  const [threshold, setThreshold] = useState(0.3)
  const [isSource, setIsSource] = useState(true)
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    const loadCSV = async (filename) => {
      const response = await fetch(`/${filename}.csv`)
      const text = await response.text()
      return Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      }).data
    }

    Promise.all([
      loadCSV('Relatedness skills'),
      loadCSV('Relatedness ability'),
      loadCSV('Relatedness average age'),
      loadCSV('Relatedness income'),
      loadCSV('Relatedness gender')
    ]).then(([skills, ability, age, income, gender]) => {
      setMatrices({ skills, ability, age, income, gender })
      
      // Set jobs from first matrix
      const jobTitles = Object.keys(skills[0])
        .filter(key => key !== "SOURCE GROUP /// TARGET GROUP -->")
      setJobs(jobTitles)
      setSelectedJob(jobTitles[0])
    })
  }, [])

  const calculateWeightedMatrix = () => {
    if (!Object.values(matrices).every(Boolean)) return null

    // Normalize weights to sum to 1
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([key, value]) => [key, value / weightSum])
    )

    // Create weighted average matrix
    return matrices.skills.map(row => {
      const sourceJob = row["SOURCE GROUP /// TARGET GROUP -->"]
      const newRow = { "SOURCE GROUP /// TARGET GROUP -->": sourceJob }
      
      jobs.forEach(targetJob => {
        newRow[targetJob] = 
          matrices.skills.find(r => r["SOURCE GROUP /// TARGET GROUP -->"] === sourceJob)[targetJob] * normalizedWeights.skills +
          matrices.ability.find(r => r["SOURCE GROUP /// TARGET GROUP -->"] === sourceJob)[targetJob] * normalizedWeights.ability +
          matrices.age.find(r => r["SOURCE GROUP /// TARGET GROUP -->"] === sourceJob)[targetJob] * normalizedWeights.age +
          matrices.income.find(r => r["SOURCE GROUP /// TARGET GROUP -->"] === sourceJob)[targetJob] * normalizedWeights.income +
          matrices.gender.find(r => r["SOURCE GROUP /// TARGET GROUP -->"] === sourceJob)[targetJob] * normalizedWeights.gender
      })
      
      return newRow
    })
  }

  const WeightSlider = ({ name, label }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} Weight: {weights[name].toFixed(2)}
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={weights[name]}
        onChange={(e) => setWeights(prev => ({
          ...prev,
          [name]: parseFloat(e.target.value)
        }))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  )

  const prepareSankeyData = () => {
    const transitionData = calculateWeightedMatrix()
    if (!transitionData || !selectedJob) return null

    let nodes = []
    let links = []

    if (isSource) {
      const sourceRow = transitionData.find(row => 
        row["SOURCE GROUP /// TARGET GROUP -->"] === selectedJob
      )
      if (!sourceRow) return null

      nodes = [{ id: selectedJob }]
      
      Object.entries(sourceRow).forEach(([targetJob, value]) => {
        if (
          targetJob !== "SOURCE GROUP /// TARGET GROUP -->" && 
          targetJob !== selectedJob &&
          value !== null && 
          value !== undefined && 
          !isNaN(value) && 
          value <= threshold
        ) {
          nodes.push({ id: targetJob })
          links.push({
            source: selectedJob,
            target: targetJob,
            value: 1 - value
          })
        }
      })
    } else {
      nodes = [{ id: selectedJob }]
      
      transitionData.forEach(row => {
        const sourceJob = row["SOURCE GROUP /// TARGET GROUP -->"]
        const value = row[selectedJob]
        if (
          sourceJob && 
          sourceJob !== selectedJob &&
          value !== null && 
          value !== undefined && 
          !isNaN(value) && 
          value <= threshold
        ) {
          nodes.push({ id: sourceJob })
          links.push({
            source: sourceJob,
            target: selectedJob,
            value: 1 - value
          })
        }
      })
    }

    const uniqueNodes = Array.from(new Set(nodes.map(n => n.id))).map(id => ({ id }))
    const sortedLinks = links.sort((a, b) => b.value - a.value)

    return sortedLinks.length > 0 ? { nodes: uniqueNodes, links: sortedLinks } : null
  }

  const sankeyData = prepareSankeyData()

  if (!Object.values(matrices).every(Boolean)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-600 animate-pulse">
          Loading data...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Job Transition Analysis
          </h1>
          <p className="mt-2 text-gray-600">
            Explore possible job transitions based on multiple similarity metrics. All metrics are first percentile normalized, then a weighted average over them is taken.
          </p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Main Controls */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">
                Main Controls
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Job
                </label>
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg shadow-sm p-2.5 
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {jobs.map(job => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Distance Threshold: {threshold.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="mt-1 text-sm text-gray-500">
                  Lower values indicate more similar jobs
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transition Direction
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={isSource}
                      onChange={() => setIsSource(true)}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">From Selected Job</span>
                  </label>
                  <label className="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isSource}
                      onChange={() => setIsSource(false)}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">To Selected Job</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Weights Panel */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">
                Similarity Weights
              </h2>
              <div className="space-y-4">
                <WeightSlider name="skills" label="Skills" />
                <WeightSlider name="ability" label="Ability" />
                <WeightSlider name="age" label="Age" />
                <WeightSlider name="income" label="Income" />
                <WeightSlider name="gender" label="Gender" />
                <div className="text-sm text-gray-500 mt-2">
                  Weights are automatically normalized to sum to 1
                </div>
              </div>
            </div>
          </div>

          {/* Visualization Panel */}
          <div className="md:col-span-3 bg-white rounded-xl shadow-sm p-6">
            {sankeyData ? (
              <div style={{ height: '600px' }}>
                <ResponsiveSankey
                  data={sankeyData}
                  margin={{ top: 40, right: 240, bottom: 40, left: 240 }}
                  align="justify"
                  colors={{ scheme: 'category10' }}
                  nodeOpacity={1}
                  nodeThickness={18}
                  nodeInnerPadding={3}
                  nodeSpacing={24}
                  nodeBorderWidth={0}
                  linkOpacity={0.5}
                  linkHoverOpacity={0.8}
                  linkContract={3}
                  enableLinkGradient={true}
                  labelPosition="outside"
                  labelOrientation="horizontal"
                  labelPadding={16}
                  label={d => d.id}
                  animate={false}
                  tooltipFormat={value => `Similarity: ${(1 - value).toFixed(3)}`}
                />
              </div>
            ) : (
              <div className="h-[600px] flex items-center justify-center">
                <div className="text-center p-8 max-w-md">
                  <div className="text-4xl mb-4 text-gray-400">
                    ⚠️
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    No Transitions Found
                  </h3>
                  <p className="text-gray-600">
                    Try adjusting the distance threshold or weights to see more possible transitions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">
            Statistics
          </h2>
          {sankeyData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Number of possible transitions</div>
                <div className="text-2xl font-bold text-gray-800">{sankeyData.links.length}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Average similarity score</div>
                <div className="text-2xl font-bold text-gray-800">
                  {(sankeyData.links.reduce((acc, link) => acc + (1 - link.value), 0) / sankeyData.links.length).toFixed(3)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 italic">
              No transition statistics available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App