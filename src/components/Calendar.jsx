// 📁 src/components/Calendar.jsx
import React from 'react'
import './Calendar.css'

function Calendar() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1 // JS 中月份從 0 開始
  const date = today.getDate()
  const dayOfWeek = today.getDay()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']

  const formattedTitle = `${year}年${month}月${date}號（${weekNames[dayOfWeek]}）`

  // 取得當月第一天是星期幾
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  // 建構月曆資料（前面補空白）
  const calendarDays = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  return (
    <div className="calendar-container">
      <div className="section-title">{formattedTitle}</div>

      <div className="calendar-grid">
        {weekNames.map((day, index) => (
          <div key={index} className="calendar-day-name">{day}</div>
        ))}

        {calendarDays.map((d, index) => (
          <div
            key={index}
            className={`calendar-day ${d === date ? 'today' : ''} ${d === null ? 'empty' : ''}`}
          >
            {d !== null ? d : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Calendar
