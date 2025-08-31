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

  //------------------------------------------------------------
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
      .filter(row => row.IncidentDate && !isNaN(new Date(row.IncidentDate).getTime()));

    const xLabels = filtered.map(row => {
      const date = new Date(row.IncidentDate);
      return date instanceof Date && !isNaN(date)
        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Invalid Date"; 
    });

    const counts = filtered.map(row => row.NewIncidentCount ?? 0);

      setLineData({ xLabels, counts });
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

    // -------- Pie Chart API ----------
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

  // -------- Pie Chart API ----------

  fetch("/if-responded")
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      const pieDataFormatted = data.data.map((row, index) => ({
        id: index,
        value: row.Count ?? 0,
        label: row.responded
      }));

      setPie2Data([{ data: pieDataFormatted }]);
    }
  })
  .catch(err => console.error("Error fetching responded pie chart data:", err));

  }, []);

  if (!barData || !pieData || !pieData2 || !lineData) {
    return <p>Loading dashboard...</p>;
  }

  return (

    
    <div className="dashboard-container">
    
    {/* Top Row: Cards */}
        
    <div className="cards">

        {cards.map((card, index) => {
          let number = 0;
          switch (card.title) {
            case 'New incidents':
              number = lineData.counts.reduce((a, b) => a + b, 0);
              break;
            case 'Assigned Incidents':
              number = barData.assignedCounts.reduce((a, b) => a + b, 0);
              break;
            case 'Pending Incidents':
              number = barData.pendingCounts.reduce((a, b) => a + b, 0);
              break;
            case 'Closed Incidents':
              number = barData.closedCounts.reduce((a, b) => a + b, 0);
              break;
          }

        return (
          <Card>
            <CardActionArea>
              <CardContent>
                <h2>{card.title}</h2>
              <h3>{number}</h3>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}

    </div>
    {/*----------------ALL CHARTS---------------*/}
    <div className="charts-container">
      {/* Bar Chart */}
      <div className= "bar-chart-1">
        <h2>Incidents per Department</h2>

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

      {/* Pie Chart 1*/}
      <div className="pie-chart-1">
          <h2>Affected Individuals by Type</h2>
          <PieChart width={300} height={300} series={pieData} />
      </div>

      {/* Pie Chart 2 */}
      <div className="pie-chart-2">
          <h2> Responded by Department</h2>
          <PieChart width={300} height={300} series={pieData2} />
       </div>
   
      {/*Line Chart */}
      <div className="line-chart">
        <h2>New Incidents per Day</h2>
        <LineChart
          xAxis={[{ data: lineData.xLabels, scaleType: 'point' }]}
          series={[{ data: lineData.counts, label: 'New Incidents' },
                   { data: barData.pendingCounts, label: 'Pending'},
                   { data: barData.closedCounts, label: 'Closed' },
          ]}
          
          height={300}
        />
      </div>
      </div>
    </div>

  );
}   