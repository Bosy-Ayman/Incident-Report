import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import './Dashboard.css';
import '../components/Loading.css';

export default function Dashboard() {
  const [data, setData] = useState({
    barData: null,
    pieData: null,
    pieData2: null,
    lineData: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cards = [
    { id: 1, title: 'New incidents' },
    { id: 2, title: 'Assigned Incidents' },
    { id: 3, title: 'Pending Incidents' },
    { id: 4, title: 'Closed Incidents' },
  ];

  const fetchData = async (url) => {
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== 'success') throw new Error('Failed to fetch');
      return json.data;
    } catch (err) {
      console.error(`Error fetching ${url}:`, err);
      setError(`Error loading ${url}`);
      return null;
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      const [lineRaw, barRaw, pieRaw, pie2Raw] = await Promise.all([
        fetchData('/incident-per-date'),
        fetchData('/incident-per-department'),
        fetchData('/affected-types'),
        fetchData('/if-responded'),
      ]);

      // Process LineChart data
      const lineData =
        lineRaw?.map
          ? (() => {
              const filtered = lineRaw
                .filter(row => row.IncidentDate && !isNaN(new Date(row.IncidentDate).getTime()))
                .sort((a, b) => new Date(a.IncidentDate) - new Date(b.IncidentDate));
              return {
                xLabels: filtered.map(row =>
                  new Date(row.IncidentDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                ),
                newCounts: filtered.map(row => row.NewIncidentCount ?? 0),
                assignedCounts: filtered.map(row => row.AssignedIncidentCount ?? 0),
                pendingCounts: filtered.map(row => row.PendingIncidentCount ?? 0),
                closedCounts: filtered.map(row => row.ClosedIncidentCount ?? 0),
              };
            })()
          : null;

      // Process BarChart data
      const barData = barRaw
        ? {
            departments: barRaw.map(row => row.DepartmentName),
            assignedCounts: barRaw.map(row => row.AssignedCount ?? 0),
            pendingCounts: barRaw.map(row => row.PendingCount ?? 0),
            closedCounts: barRaw.map(row => row.ClosedCount ?? 0),
          }
        : null;

      // Process PieCharts
      const pieData = pieRaw
        ? [
            {
              data: pieRaw.map((row, index) => ({
                id: index,
                value: row.Count ?? 0,
                label: row.Type,
              })),
            },
          ]
        : null;

      const pieData2 = pie2Raw
        ? [
            {
              data: pie2Raw.map((row, index) => ({
                id: index,
                value: row.Count ?? 0,
                label: row.ResponseStatus || row.responded || 'Unknown',
              })),
            },
          ]
        : null;

      setData({ lineData, barData, pieData, pieData2 });
      setLoading(false);
    };

    loadAllData();
  }, []);

if (loading) {
  return (
    <div 
      className="protected-container" 
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
    >
      <div className="loader"></div>
    </div>
  );
}

if (error) {
  return (
    <Typography 
      color="error" 
      sx={{ textAlign: 'center', mt: 4 }}
    >
      {error}
    </Typography>
  );
}

  const getTotalForCard = (cardTitle) => {
    const { lineData, barData } = data;
    switch (cardTitle) {
      case 'New incidents':
        return lineData.newCounts.reduce((a, b) => a + b, 0);
      case 'Assigned Incidents':
        return barData.assignedCounts.reduce((a, b) => a + b, 0);
      case 'Pending Incidents':
        return barData.pendingCounts.reduce((a, b) => a + b, 0);
      case 'Closed Incidents':
        return barData.closedCounts.reduce((a, b) => a + b, 0);
      default:
        return 0;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Cards */}
      <div className="cards">
        {cards.map((card) => (
          <Card key={card.id}>
            <CardActionArea>
              <CardContent>
                <Typography variant="h6">{card.title}</Typography>
                <Typography variant="h4" color="primary">{getTotalForCard(card.title)}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </div>

      {/* Charts */}
     {/* Charts */}
<div className="charts-container">
  {/* Bar Chart */}
  <div className="bar-chart-1">
    <Typography variant="h6">Incidents per Department</Typography>
    <BarChart
      height={300}
      series={[
        { data: data.barData.assignedCounts, label: 'Assigned', stack: 'total' },
        { data: data.barData.pendingCounts, label: 'Pending', stack: 'total' },
        { data: data.barData.closedCounts, label: 'Done', stack: 'total' },
      ]}
      xAxis={[{ data: data.barData.departments, scaleType: 'band' }]}
      yAxis={[{ width: 50 }]}
    />
  </div>

  {/* Line Chart */}
  <div className="line-chart">
    <Typography variant="h6">Incidents Over Time</Typography>
    <LineChart
      xAxis={[{ data: data.lineData.xLabels, scaleType: 'point' }]}
      series={[
        { data: data.lineData.newCounts, label: 'New Incidents', color: '#1976d2' },
        { data: data.lineData.assignedCounts, label: 'Assigned', color: '#ff9800' },
        { data: data.lineData.pendingCounts, label: 'Pending', color: '#f44336' },
        { data: data.lineData.closedCounts, label: 'Closed', color: '#4caf50' },
      ]}
      height={300}
      grid={{ vertical: true, horizontal: true }}
    />
  </div>

  {/* Pie Chart 1 */}
  <div className="pie-chart pie-chart-1">
    <Typography variant="h6">Affected Individuals by Type</Typography>
    <PieChart
      width={300}
      height={300}
      series={data.pieData}
      slotProps={{
        legend: { direction: 'column', position: { vertical: 'middle', horizontal: 'right' }, padding: 0 },
      }}
    />
  </div>

  {/* Pie Chart 2 */}
  <div className="pie-chart pie-chart-2">
    <Typography variant="h6">Response Status</Typography>
    <PieChart
      width={300}
      height={300}
      series={data.pieData2}
      slotProps={{
        legend: { direction: 'column', position: { vertical: 'middle', horizontal: 'right' }, padding: 0 },
      }}
    />
  </div>
</div>

    </div>
  );
}
