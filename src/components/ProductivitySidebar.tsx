import React, { useEffect, useState } from "react";
import styles from "./ProductivitySidebar.module.css";

interface ProductivitySidebarProps {
  isVisible: boolean;
}

interface ProgressData {
  percentage: number;
  remaining: string;
  total: string;
  color: string;
}

const ProductivitySidebar: React.FC<ProductivitySidebarProps> = ({
  isVisible,
}) => {
  const [yearProgress, setYearProgress] = useState<ProgressData>({
    percentage: 0,
    remaining: "",
    total: "",
    color: "#00a8cc",
  });
  const [monthProgress, setMonthProgress] = useState<ProgressData>({
    percentage: 0,
    remaining: "",
    total: "",
    color: "#ff6b6b",
  });
  const [weekProgress, setWeekProgress] = useState<ProgressData>({
    percentage: 0,
    remaining: "",
    total: "",
    color: "#4ecdc4",
  });
  const [dayProgress, setDayProgress] = useState<ProgressData>({
    percentage: 0,
    remaining: "",
    total: "",
    color: "#45b7d1",
  });

  useEffect(() => {
    const calculateProgress = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      // Calculate year progress
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear + 1, 0, 1);
      const totalDaysInYear = Math.ceil(
        (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysPassed = Math.ceil(
        (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
      );
      const yearProgressPercent = Math.round(
        (daysPassed / totalDaysInYear) * 100
      );
      const daysRemaining = totalDaysInYear - daysPassed;

      setYearProgress({
        percentage: yearProgressPercent,
        remaining: `${daysRemaining}d left`,
        total: `${daysPassed}/${totalDaysInYear}`,
        color:
          yearProgressPercent > 75
            ? "#ff6b6b"
            : yearProgressPercent > 50
            ? "#ffa726"
            : "#00a8cc",
      });

      // Calculate month progress
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const totalDaysInMonth = endOfMonth.getDate();
      const dayOfMonth = now.getDate();
      const monthProgressPercent = Math.round(
        (dayOfMonth / totalDaysInMonth) * 100
      );
      const monthDaysRemaining = totalDaysInMonth - dayOfMonth;

      setMonthProgress({
        percentage: monthProgressPercent,
        remaining: `${monthDaysRemaining}d left`,
        total: `${dayOfMonth}/${totalDaysInMonth}`,
        color:
          monthProgressPercent > 75
            ? "#ff6b6b"
            : monthProgressPercent > 50
            ? "#ffa726"
            : "#4ecdc4",
      });

      // Calculate week progress
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as start of week
      startOfWeek.setDate(now.getDate() + diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const weekProgressPercent = Math.round(
        ((now.getTime() - startOfWeek.getTime()) /
          (endOfWeek.getTime() - startOfWeek.getTime())) *
          100
      );
      const daysLeftInWeek = Math.ceil(
        (endOfWeek.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      setWeekProgress({
        percentage: weekProgressPercent,
        remaining: `${daysLeftInWeek}d left`,
        total: `Day ${dayOfWeek === 0 ? 7 : dayOfWeek}/7`,
        color:
          weekProgressPercent > 75
            ? "#ff6b6b"
            : weekProgressPercent > 50
            ? "#ffa726"
            : "#4ecdc4",
      });

      // Calculate day progress
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutesInDay = 24 * 60;
      const minutesPassed = hours * 60 + minutes;
      const dayProgressPercent = Math.round(
        (minutesPassed / totalMinutesInDay) * 100
      );
      const hoursRemaining = 24 - hours - (minutes > 0 ? 1 : 0);

      setDayProgress({
        percentage: dayProgressPercent,
        remaining: `${hoursRemaining}h left`,
        total: `${hours}:${minutes.toString().padStart(2, "0")}`,
        color:
          dayProgressPercent > 75
            ? "#ff6b6b"
            : dayProgressPercent > 50
            ? "#ffa726"
            : "#45b7d1",
      });
    };

    calculateProgress();

    // Update every minute instead of every second
    const interval = setInterval(calculateProgress, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  const ProgressItem: React.FC<{
    label: string;
    data: ProgressData;
    icon: string;
  }> = ({ label, data, icon }) => (
    <div
      className={styles.progressItem}
      title={`${label}: ${data.total} • ${data.remaining}`}
    >
      <div className={styles.progressContent}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>
            {icon} {label}
          </span>
          <span className={styles.progressPercent}>{data.percentage}%</span>
        </div>
        <div className={styles.progressBarContainer}>
          <div
            className={styles.progressBar}
            style={{
              width: `${data.percentage}%`,
              background: `linear-gradient(90deg, ${data.color}aa 0%, ${data.color} 100%)`,
            }}
          />
        </div>
        <div className={styles.progressDetails}>
          <span className={styles.progressTotal}>{data.total}</span>
          <span className={styles.progressRemaining}>{data.remaining}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.sidebar}>
      <div className={styles.progressContainer}>
        <ProgressItem label="YEAR" data={yearProgress} icon="🗓️" />
        <ProgressItem label="MONTH" data={monthProgress} icon="📅" />
        <ProgressItem label="WEEK" data={weekProgress} icon="📊" />
        <ProgressItem label="DAY" data={dayProgress} icon="⏰" />
      </div>
    </div>
  );
};

export default ProductivitySidebar;
