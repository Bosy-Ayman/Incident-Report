import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
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
    barData2: null,
    pieData: null,
    pieData2: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cards = [
    { id: 1, title: 'New Incidents' },
    { id: 2, title: 'Assigned Incidents' },
    { id: 3, title: 'Pending Incidents' },
    { id: 4, title: 'Closed Incidents' },
  ];
  const chartSetting = {
  xAxis: [
    {
      label: 'rainfall (mm)',
    },
  ],
  height: 400,
  margin: { left: 0 },
};


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

      // Process BarChart data for average resolution time from /incident-per-date
      const barData2 = lineRaw
        ? {
            departments: lineRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.DepartmentName),
            avgtime: lineRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.AvgResolutionHours ?? 0),
            incidentCounts: lineRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.IncidentCount ?? 0),
          }
        : null;

      // Process BarChart data for departments
      const barData = barRaw
        ? {
            departments: barRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.DepartmentName),
            assignedCounts: barRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.AssignedCount ?? 0),
            pendingCounts: barRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.PendingCount ?? 0),
            closedCounts: barRaw
              .filter(row => row.DepartmentName !== null && row.DepartmentName !== 'null')
              .map(row => row.ClosedCount ?? 0),
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

      setData({ barData, barData2, pieData, pieData2 });
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
    const { barData, barData2 } = data; // Added barData2 to destructuring
    switch (cardTitle) {
      case 'New Incidents':
        return barData2?.incidentCounts?.reduce((a, b) => a + b, 0) ?? 0; // Use incidentCounts
      case 'Assigned Incidents':
        return barData?.assignedCounts?.reduce((a, b) => a + b, 0) ?? 0;
      case 'Pending Incidents':
        return barData?.pendingCounts?.reduce((a, b) => a + b, 0) ?? 0;
      case 'Closed Incidents':
        return barData?.closedCounts?.reduce((a, b) => a + b, 0) ?? 0;
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
      <div className="charts-container">
        {/* Bar Chart 1: Incidents per Department */}
        <div className="bar-chart-1">
          <Typography variant="h6">Incidents per Department</Typography>
          {data.barData && (
            <BarChart
              height={300}
              series={[
                { data: data.barData.assignedCounts, label: 'Assigned', stack: 'total' },
                { data: data.barData.pendingCounts, label: 'Pending', stack: 'total' },
                { data: data.barData.closedCounts, label: 'Done', stack: 'total' },
              ]}
              xAxis={[{ data: data.barData.departments, scaleType: 'band' }]}
              yAxis={[{ width: 50 }]}
              colors={['#3b98c0', '#f59e0b', '#16a34a']}
            />
          )}
        </div>

        {/* Bar Chart 3: Average Resolution Time per Department */}
        <div className="bar-chart-3">
          <Typography variant="h6">Average Resolution Time per Department</Typography>
          {data.barData2 && (
            <BarChart
              height={300}
              layout="horizontal"
              series={[
                { data: data.barData2.avgtime, label: 'Avg Resolution Hours' },
              ]}
              
              yAxis={[{ data: data.barData2.departments, scaleType: 'band' }]}
              xAxis={[{ scaleType: 'linear' }]}
              colors={['#1d83aeff']}
              
            />
          )}
        </div>

        {/* Pie Chart 1 */}
        <div className="pie-chart pie-chart-1">
          <Typography variant="h6">Affected Individuals by Type</Typography>
          {data.pieData && (
            <PieChart
              width={300}
              height={300}
              series={data.pieData}
              slotProps={{
                legend: { direction: 'column', position: { vertical: 'left', horizontal: 'right' } },
              }}
            />
          )}
        </div>

        {/* Pie Chart 2 */}
        <div className="pie-chart pie-chart-2">
          <Typography variant="h6">Response Status</Typography>
          {data.pieData2 && (
            <PieChart
              width={300}
              height={300}
              series={data.pieData2}
              
               layout="horizontal"
              slotProps={{
                legend: { direction: 'column', position: { vertical: 'left', horizontal: 'right' }, padding: 0 },
              }}
             
            />
          )}
        </div>
      </div>
    </div>
  );
}