'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

const AVATAR_COLORS = ['#2563EB','#16A34A','#D97706','#DC2626','#0D9488','#7C3AED'];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [callStats, setCallStats] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ name:'', email:'', password:'', phone:'' });
  const [loading,   setLoading]   = useState(false);

  const fetchEmployees = async () => {
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get('/api/employees'),
        api.get('/api/calls/stats'),
      ]);
      setEmployees(empRes.data.data);
      const map = {};
      (statsRes.data.data.topDialers||[]).forEach(d=>{map[d.employeeId]=d.count;});
      setCallStats(map);
    } catch {}
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/api/employees', form);
      toast.success('Employee added');
      setShowModal(false);
      setForm({ name:'', email:'', password:'', phone:'' });
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add employee'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees</h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>{employees.length} team members</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="btn-primary">+ Add Employee</button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {employees.map((emp,i)=>{
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const todayCalls = callStats[emp._id] || 0;
          return (
            <div key={emp._id} className="page-card p-5 flex flex-col gap-4 group"
              style={{ transition:'box-shadow 0.18s' }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
              {/* Top */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                  style={{ background:color }}>
                  {emp.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color:'#0F172A' }}>{emp.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color:'#94A3B8' }}>{emp.email}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                  style={emp.isActive
                    ? { background:'rgba(22,163,74,0.08)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.22)' }
                    : { background:'rgba(148,163,184,0.10)', color:'#64748B', border:'1px solid #E2E8F0' }}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg p-3 text-center" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color:'#2563EB', letterSpacing:'-0.03em' }}>{todayCalls}</p>
                  <p className="text-[11px] mt-1 font-medium" style={{ color:'#94A3B8' }}>Calls Today</p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                  <p className="text-xs font-bold truncate" style={{ color:'#0F172A' }}>{emp.phone || '—'}</p>
                  <p className="text-[11px] mt-1 font-medium" style={{ color:'#94A3B8' }}>Mobile</p>
                </div>
              </div>

              {/* CTA */}
              <Link href={`/employees/${emp._id}`}
                className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-lg transition-all"
                style={{ background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#2563EB';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#2563EB';}}
                onMouseLeave={e=>{e.currentTarget.style.background='#EFF6FF';e.currentTarget.style.color='#2563EB';e.currentTarget.style.borderColor='#BFDBFE';}}>
                View Profile →
              </Link>
            </div>
          );
        })}

        {employees.length === 0 && (
          <div className="col-span-full page-card p-12 text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background:'#EFF6FF', color:'#2563EB' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p className="font-semibold" style={{ color:'#0F172A' }}>No employees yet</p>
            <p className="text-sm mt-1" style={{ color:'#94A3B8' }}>Add your first team member to get started.</p>
            <button onClick={()=>setShowModal(true)} className="btn-primary mt-4">+ Add Employee</button>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background:'rgba(0,0,0,0.50)', backdropFilter:'blur(5px)' }}>
          <div className="w-full max-w-md rounded-xl modal-content"
            style={{ background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Add New Employee</h3>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>They'll receive login credentials for the mobile app</p>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color:'#94A3B8' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
                onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
                <CloseIco />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              {[
                {k:'name',l:'Full Name',t:'text',ph:'John Doe'},
                {k:'email',l:'Email',t:'email',ph:'john@company.com'},
                {k:'password',l:'Password',t:'password',ph:'Min 6 characters'},
                {k:'phone',l:'Phone (optional)',t:'text',ph:'+91 99999 99999'},
              ].map(({k,l,t,ph})=>(
                <div key={k}>
                  <label className="block text-xs font-medium mb-1" style={{ color:'#475569' }}>{l}</label>
                  <input type={t} required={k!=='phone'} value={form[k]} placeholder={ph}
                    onChange={e=>setForm({...form,[k]:e.target.value})} className="form-input" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center" style={{ opacity:loading?0.7:1 }}>
                  {loading?'Adding…':'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
