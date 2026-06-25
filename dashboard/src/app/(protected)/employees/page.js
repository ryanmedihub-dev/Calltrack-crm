'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

const inputStyle = { background: '#F8FAFF', border: '1px solid #E2E8F4', color: '#0F172A', outline: 'none', fontSize: '13px', borderRadius: '10px', padding: '8px 12px' };

function CloseIco() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function PhoneIco() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function ArrowRight() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366F1, #8B5CF6)',
  'linear-gradient(135deg, #10B981, #14B8A6)',
  'linear-gradient(135deg, #F59E0B, #F97316)',
  'linear-gradient(135deg, #EF4444, #F97316)',
  'linear-gradient(135deg, #0EA5E9, #6366F1)',
  'linear-gradient(135deg, #8B5CF6, #EC4899)',
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [callStats, setCallStats] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', password:'', phone:'' });
  const [loading, setLoading] = useState(false);

  const fetchEmployees = async () => {
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get('/api/employees'),
        api.get('/api/calls/stats'),
      ]);
      setEmployees(empRes.data.data);
      const map = {};
      (statsRes.data.data.topDialers || []).forEach(d => { map[d.employeeId] = d.count; });
      setCallStats(map);
    } catch {}
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAddEmployee = async (e) => {
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
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold leading-none" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>Employees</h2>
          <p className="text-sm mt-1" style={{ color:'#94A3B8' }}>{employees.length} team members</p>
        </div>
        <button onClick={()=>setShowModal(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white"
          style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 4px 12px rgba(99,102,241,0.30)' }}>
          + Add Employee
        </button>
      </div>

      {/* Employee cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {employees.map((emp, i) => {
          const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
          const todayCalls = callStats[emp._id] || 0;
          return (
            <div key={emp._id}
              className="rounded-2xl p-5 flex flex-col gap-4 card-hover group"
              style={{ background:'#fff', border:'1px solid #E2E8F4', boxShadow:'0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)' }}>
              {/* Top row */}
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 select-none"
                  style={{ background: grad, boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>
                  {emp.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color:'#0F172A' }}>{emp.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color:'#94A3B8' }}>{emp.email}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${emp.isActive ? '' : ''}`}
                  style={emp.isActive
                    ? { background:'rgba(16,185,129,0.10)', color:'#059669', border:'1px solid rgba(16,185,129,0.22)' }
                    : { background:'rgba(148,163,184,0.10)', color:'#64748B', border:'1px solid rgba(148,163,184,0.22)' }}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl p-3 text-center" style={{ background:'#F8FAFF', border:'1px solid #EEF2FF' }}>
                  <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color:'#6366F1', letterSpacing:'-0.03em' }}>
                    {todayCalls}
                  </p>
                  <p className="text-xs mt-1 font-medium" style={{ color:'#94A3B8' }}>Calls Today</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background:'#F8FAFF', border:'1px solid #EEF2FF' }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span style={{ color:'#94A3B8' }}><PhoneIco /></span>
                    <p className="text-xs font-bold truncate" style={{ color:'#0F172A' }}>{emp.phone || '—'}</p>
                  </div>
                  <p className="text-xs font-medium" style={{ color:'#94A3B8' }}>Mobile</p>
                </div>
              </div>

              {/* CTA */}
              <Link href={`/employees/${emp._id}`}
                className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all"
                style={{ background:'#EEF2FF', color:'#6366F1' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='linear-gradient(135deg,#6366F1,#8B5CF6)'; e.currentTarget.style.color='#fff'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='#EEF2FF'; e.currentTarget.style.color='#6366F1'; }}>
                View Profile <ArrowRight />
              </Link>
            </div>
          );
        })}

        {employees.length === 0 && (
          <div className="col-span-full rounded-2xl p-12 text-center"
            style={{ background:'#fff', border:'1px solid #E2E8F4' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:'#EEF2FF', color:'#818CF8' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p className="font-semibold" style={{ color:'#0F172A' }}>No employees yet</p>
            <p className="text-sm mt-1" style={{ color:'#94A3B8' }}>Add your first team member to get started.</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 modal-overlay"
          style={{ background:'rgba(12,10,30,0.55)', backdropFilter:'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl modal-content"
            style={{ background:'#fff', border:'1px solid #E2E8F4', boxShadow:'0 25px 80px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom:'1px solid #F1F5F9' }}>
              <div>
                <h3 className="font-bold" style={{ color:'#0F172A' }}>Add New Employee</h3>
                <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>They'll receive login credentials for the mobile app</p>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color:'#94A3B8' }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FFF1F2';e.currentTarget.style.color='#EF4444';}}
                onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='#94A3B8';}}>
                <CloseIco />
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-5 space-y-4">
              {[
                { key:'name',     label:'Full Name',  type:'text',     placeholder:'John Doe' },
                { key:'email',    label:'Email',      type:'email',    placeholder:'john@company.com' },
                { key:'password', label:'Password',   type:'password', placeholder:'Min 6 characters' },
                { key:'phone',    label:'Phone',      type:'text',     placeholder:'+91 99999 99999' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:'#64748B' }}>{label}</label>
                  <input type={type} required={key!=='phone'} value={form[key]}
                    onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder}
                    className="w-full transition-all input-ring" style={inputStyle} />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ border:'1px solid #E2E8F4', color:'#64748B' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#FECACA';e.currentTarget.style.color='#EF4444';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F4';e.currentTarget.style.color='#64748B';}}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', opacity:loading?0.7:1 }}>
                  {loading ? 'Adding…' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
