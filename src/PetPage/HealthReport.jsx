import React from 'react';
import './HealthReport.css';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip);
