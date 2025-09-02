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

export default function Dashboard() {
  const [barData, setBarData] = useState(null);
  const [pieData, setPieData] = useState(null);
  const [pieData2, setPie2Data] = useState(null);
  const [lineData, setLineData] = useState(null);

  const cards = [
    {
      id: 1,
      title: 'New incidents',
    },
    {
      id: 2,
      title: 'Assigned Incidents',
    },
    {
      id: 3,
      title: 'Pending Incidents',
    },
    {
      id: 4,
      title: 'Closed Incidents',
    },
  ];
  
  useEffect(() => {
    // -------- Line Chart API ----------
    fetch('/incident-per-date')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          const filtered = data.data
            .filter(row => row.IncidentDate && !isNaN(new Date(row.IncidentDate).getTime()))
            .sort((a, b) => new Date(a.IncidentDate) - new Date(b.IncidentDate));

          const xLabels = filtered.map(row => {
            const date = new Date(row.IncidentDate);
            return date instanceof Date && !isNaN(date)
              ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Invalid Date"; 
          });

          const newCounts = filtered.map(row => row.NewIncidentCount ?? 0);
          const assignedCounts = filtered.map(row => row.AssignedIncidentCount ?? 0);
          const pendingCounts = filtered.map(row => row.PendingIncidentCount ?? 0);
          const closedCounts = filtered.map(row => row.ClosedIncidentCount ?? 0);

          setLineData({ 
            xLabels, 
            newCounts,
            assignedCounts,
            pendingCounts, 
            closedCounts 
          });
        }
      })
      .catch(err => console.error("Error fetching line chart data:", err));

    // -------- BarChart API ----------
    fetch("/incident-per-department")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          const departments = data.data.map(row => row.DepartmentName);
          const assignedCounts = data.data.map(row => row.AssignedCount ?? 0);
          const pendingCounts = data.data.map(row => row.PendingCount ?? 0);
          const closedCounts = data.data.map(row => row.ClosedCount ?? 0);

          setBarData({ departments, assignedCounts, pendingCounts, closedCounts });
        }
      })
      .catch(err => console.error("Error fetching bar chart data:", err));

    // -------- Pie Chart API (Affected Types) ----------
    fetch("/affected-types")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          const seriesData = data.data.map((row, index) => ({
            id: index,
            value: row.Count ?? 0,
            label: row.Type
          }));

          setPieData([{ data: seriesData }]);
        }
      })
      .catch(err => console.error("Error fetching pie chart data:", err));

    // -------- Pie Chart API (Response Status) ----------
    fetch("/if-responded")
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          const pieDataFormatted = data.data.map((row, index) => ({
            id: index,
            value: row.Count ?? 0,
            label: row.ResponseStatus || row.responded || 'Unknown'
          }));

          setPie2Data([{ data: pieDataFormatted }]);
        }
      })
      .catch(err => console.error("Error fetching responded pie chart data:", err));

  }, []);

  // Show loading state while data is being fetched
  if (!barData || !pieData || !pieData2 || !lineData) {
    return (
      <div className="dashboard-container">
        <Typography variant="h6" sx={{ textAlign: 'center', mt: 4 }}>
          Loading dashboard...
        </Typography>
      </div>
    );
  }

  // Calculate totals for cards
  const getTotalForCard = (cardTitle) => {
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
      {/* Top Row: Cards */}
      <div className="cards">
        {cards.map((card) => (
          <Card key={card.id}>
            <CardActionArea>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="h4" component="h3" color="primary">
                  {getTotalForCard(card.title)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </div>

      {/* Charts Container */}
      <div className="charts-container">
        {/* Bar Chart */}
        <div className="bar-chart-1">
          <Typography variant="h6" component="h2" gutterBottom>
            Incidents per Department
          </Typography>
          <BarChart
            height={300}
            series={[
              { data: barData.assignedCounts, label: 'Assigned', stack: 'total' },
              { data: barData.pendingCounts, label: 'Pending', stack: 'total' },
              { data: barData.closedCounts, label: 'Done', stack: 'total' },
            ]}
            xAxis={[{ data: barData.departments, scaleType: 'band' }]}
            yAxis={[{ width: 50 }]}
          />
        </div>

        {/* Pie Chart 1 */}
        <div className="pie-chart-1">
          <Typography variant="h6" component="h2" gutterBottom>
            Affected Individuals by Type
          </Typography>
          <PieChart 
            width={300} 
            height={300} 
            series={pieData}
            slotProps={{
              legend: {
                direction: 'column',
                position: { vertical: 'middle', horizontal: 'right' },
                padding: 0,
              },
            }}
          />
        </div>

        {/* Pie Chart 2 */}
        <div className="pie-chart-2">
          <Typography variant="h6" component="h2" gutterBottom>
            Response Status
          </Typography>
          <PieChart 
            width={300} 
            height={300} 
            series={pieData2}
            slotProps={{
              legend: {
                direction: 'column',
                position: { vertical: 'middle', horizontal: 'right' },
                padding: 0,
              },
            }}
          />
        </div>
   
        {/* Line Chart */}
        <div className="line-chart">
          <Typography variant="h6" component="h2" gutterBottom>
            Incidents Over Time
          </Typography>
          <LineChart
            xAxis={[{ data: lineData.xLabels, scaleType: 'point' }]}
            series={[
              { data: lineData.newCounts, label: 'New Incidents', color: '#1976d2' },
              { data: lineData.assignedCounts, label: 'Assigned', color: '#ff9800' },
              { data: lineData.pendingCounts, label: 'Pending', color: '#f44336' },
              { data: lineData.closedCounts, label: 'Closed', color: '#4caf50' },
            ]}
            height={300}
            grid={{ vertical: true, horizontal: true }}
          />
        </div>
      </div>
    </div>
  );
}