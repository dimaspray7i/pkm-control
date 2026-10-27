import { Users, Mail, Phone, ShieldCheck, Plus } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function Team() {
  const members = [
    { name: 'Budi Santoso',  role: 'Super Admin',     email: 'admin@pkm.co.id', phone: '0812-3456-7890', color: 'bg-[#FF2F92] text-white', projects: 'All Projects' },
    { name: 'Siti Rahma',    role: 'Project Manager', email: 'pm@pkm.co.id',    phone: '0812-3456-7892', color: 'bg-[#B8A0F0] text-[#171717]', projects: 'Website Klien A, B' },
    { name: 'Andi Pratama',  role: 'Lead Developer',  email: 'andi@pkm.co.id',  phone: '0812-3456-7893', color: 'bg-[#FFD83D] text-[#171717]', projects: 'Sistem Internal' },
    { name: 'Rizky Maulana', role: 'Mobile Engineer', email: 'rizky@pkm.co.id', phone: '0812-3456-7894', color: 'bg-[#FF2F92] text-white', projects: 'Aplikasi Mobile' },
    { name: 'Dewi Lestari',  role: 'UI/UX Designer',  email: 'dewi@pkm.co.id',  phone: '0812-3456-7895', color: 'bg-[#B8A0F0] text-[#171717]', projects: 'E-Commerce PKM' },
  ]

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <PageHeader
        title="ANGGOTA TIM"
        subtitle="Daftar tim profesional, keahlian teknis, dan penanggung jawab proyek PT Potensi Karya Mandiri."
        tag="SUMBER DAYA MANUSIA"
        actions={
          <div className="bg-white px-3 py-1.5 border-1.5 border-[#171717] rounded-lg shadow-[2px_2px_0px_#171717] flex items-center gap-2">
            <Users size={15} className="text-[#FF2F92]" />
            <span className="font-black text-xs uppercase">{members.length} Anggota Aktif</span>
          </div>
        }
      />

      {/* Grid of Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {members.map((m, idx) => (
          <div 
            key={idx} 
            className="bg-white p-4 border border-[#171717] rounded-lg shadow-[3px_3px_0px_#171717] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#171717] transition-all flex items-start gap-3.5"
          >
            {/* Avatar Circle */}
            <div className={`w-11 h-11 rounded-full ${m.color} border border-[#171717] flex items-center justify-center font-display text-lg shrink-0 shadow-[1px_1px_0px_#171717]`}>
              {m.name.charAt(0)}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base uppercase text-[#171717] truncate leading-tight">
                  {m.name}
                </h3>
              </div>

              <span className="inline-block px-2 py-0.5 bg-[#FAF7F2] border border-[#171717] rounded-sm text-[9px] font-black uppercase text-[#171717] mt-1">
                {m.role}
              </span>

              <div className="mt-3 space-y-1 text-xs font-semibold text-[#171717]/80">
                <p className="flex items-center gap-1.5 truncate">
                  <Mail size={12} className="shrink-0 text-[#171717]/50" /> {m.email}
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone size={12} className="shrink-0 text-[#171717]/50" /> {m.phone}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#171717]/10 flex items-center justify-between text-[10px]">
                <span className="text-[#171717]/60 font-bold">Fokus:</span>
                <span className="font-black text-[#171717] truncate max-w-[140px]">{m.projects}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
