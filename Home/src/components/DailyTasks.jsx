import React, { useState } from 'react'
import './DailyTasks.css'

function DailyTasks() {
  // 定義任務狀態陣列（每個任務都有文字和是否已完成）
  const [tasks, setTasks] = useState([
    { text: '社群發文 1 次', completed: false },
    { text: '閱讀 1 篇論壇文章', completed: false },
    { text: '按讚 1 篇社群貼文', completed: false },
    { text: '留言 1 篇社群貼文', completed: false },
  ])

  // 處理點擊任務的事件（toggle 是否完成）
  const toggleTask = (index) => {
    const updatedTasks = [...tasks]
    updatedTasks[index].completed = !updatedTasks[index].completed
    setTasks(updatedTasks)
  }

  return (
    <div className="task-card">
      <h3 className="section-title">每日任務</h3>
      <ul className="task-list">
        {tasks.map((task, index) => (
          <li
            key={index}
            className={task.completed ? 'task completed' : 'task'}
            onClick={() => toggleTask(index)}
          >
            {task.completed ? '✅' : '⬜'} {task.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DailyTasks
