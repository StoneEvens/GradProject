// 📁 src/components/Calendar.jsx
import React, { useState } from 'react'
import './Calendar.css'

function Calendar() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)

  const weekNames = ['日', '一', '二', '三', '四', '五', '六']

  // 取得當月第一天是星期幾
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

  // 建構月曆資料（前面補空白）
  const calendarDays = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  // 標題格式：2025年3月
  const formattedTitle = `${currentYear}年${currentMonth}月`

  // 是否為當月
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1

  // 切換月份
  const lastMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }
  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }
  // 回到今天
  const backToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
  }

  return (
    <div className="calendar-container">
      <div className="calendar-title-bar">
        <h3 className="section-title">
          {!isCurrentMonth && (
            <>
              <button name="lastMonth" className="calendar-arrow left" type="button" aria-label="上一月" onClick={lastMonth} />
              <button className="calendar-today-btn" type="button" onClick={backToToday}>回到今天</button>
              <span className="calendar-title-text">{formattedTitle}</span>
              <button name="nextMonth" className="calendar-arrow right" type="button" aria-label="下一月" onClick={nextMonth} />
            </>
          )}
          {isCurrentMonth && (
            <>
              <button name="lastMonth" className="calendar-arrow left" type="button" aria-label="上一月" onClick={lastMonth} />
              <span className="calendar-title-text-current">{today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}號（{weekNames[today.getDay()]}）</span>
              <button name="nextMonth" className="calendar-arrow right" type="button" aria-label="下一月" onClick={nextMonth} />
            </>
          )}
        </h3>
      </div>
      <div className="calendar-grid">
        {weekNames.map((day, index) => (
          <div key={index} className="calendar-day-name">{day}</div>
        ))}
        {calendarDays.map((d, index) => {
          // 1號前的空格不顯示圓點
          if (d === null) return <div key={index} className="calendar-day empty"></div>;
          // 當月且為今天時高亮
          const isToday = isCurrentMonth && d === today.getDate();
          return (
            <div
              key={index}
              className={`calendar-day${isToday ? ' today' : ''}`}
            >
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Calendar
