import { useState, useEffect } from 'react'
import api from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await api.get('/test')
        setStats(response.data.data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
        setError('Gagal mengambil data dari server. Pastikan backend Laravel berjalan.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-6xl mb-2 leading-none">
          Dashboard<span className="text-pink">.</span>
        </h1>
        <p className="text-base font-bold uppercase tracking-widest mb-10 text-ink/70">
          Overview & Analytics
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white animate-pulse"
              style={{
                border: '3px solid var(--color-ink)',
                boxShadow: '6px 6px 0px var(--color-ink)',
                padding: '2rem',
                minHeight: '180px',
              }}
            >
              <div className="h-4 bg-cream-dark w-1/2 mb-4"></div>
              <div className="h-16 bg-cream-dark w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-6xl mb-2 leading-none">
          Dashboard<span className="text-pink">.</span>
        </h1>
        <p className="text-base font-bold uppercase tracking-widest mb-10 text-ink/70">
          Overview & Analytics
        </p>
        
        <div
          className="bg-yellow p-8"
          style={{
            border: '3px solid var(--color-ink)',
            boxShadow: '6px 6px 0px var(--color-ink)',
          }}
        >
          <p className="font-bold text-lg mb-2">⚠️ {error}</p>
          <p className="text-sm">
            Pastikan server Laravel berjalan di http://127.0.0.1:8000
          </p>
        </div>
      </div>
    )
  }

  const statCards = [
    { 
      label: 'Active Projects', 
      value: stats.active_projects, 
      bg: 'var(--color-white)',
      valueColor: 'var(--color-pink)'
    },
    { 
      label: 'Pending Tasks', 
      value: stats.pending_tasks, 
      bg: 'var(--color-yellow)',
      valueColor: 'var(--color-ink)'
    },
    { 
      label: 'Team Members', 
      value: stats.team_members, 
      bg: 'var(--color-purple)',
      valueColor: 'var(--color-ink)'
    },
  ]

  return (
    <div>
      <h1 className="font-display text-6xl mb-2 leading-none">
        Dashboard<span className="text-pink">.</span>
      </h1>
      <p className="text-base font-bold uppercase tracking-widest mb-10 text-ink/70">
        Overview & Analytics
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="transition-all duration-150 cursor-pointer"
            style={{
              backgroundColor: stat.bg,
              border: '3px solid var(--color-ink)',
              boxShadow: '6px 6px 0px var(--color-ink)',
              padding: '2rem',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-3px, -3px)'
              e.currentTarget.style.boxShadow = '9px 9px 0px var(--color-ink)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(0, 0)'
              e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-ink)'
            }}
          >
            <p className="text-sm font-bold uppercase tracking-widest text-ink/70">
              {stat.label}
            </p>
            <p 
              className="font-display leading-none"
              style={{ 
                fontSize: '4rem',
                color: stat.valueColor,
                marginTop: '1rem'
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}