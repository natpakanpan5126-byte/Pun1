import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { 
  Home, 
  PlusCircle, 
  List, 
  Target, 
  Trash2, 
  DollarSign, 
  Calendar, 
  User,
  Users,
  Upload,
  CheckCircle2,
  Clock,
  TrendingUp,
  PieChart
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- Firebase Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'class-fund-app';

export default function ClassFundTracker() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Notification State
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Add Form State
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  // History State
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Members State
  const [members, setMembers] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [bulkMembers, setBulkMembers] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Goal State
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to Transactions
    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const txUnsub = onSnapshot(txRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory (Rule compliance: no complex firestore queries)
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(data);
      setLoading(false);
    }, (err) => console.error("Tx listen error:", err));

    // Listen to Current Goal
    const goalRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'currentGoal');
    const goalUnsub = onSnapshot(goalRef, (docSnap) => {
      if (docSnap.exists()) {
        setGoal(docSnap.data());
      } else {
        setGoal(null);
      }
    }, (err) => console.error("Goal listen error:", err));

    // Listen to Members
    const membersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'members');
    const membersUnsub = onSnapshot(membersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.name.localeCompare(b.name, 'th-TH'));
      setMembers(data);
    }, (err) => console.error("Members listen error:", err));

    return () => {
      txUnsub();
      goalUnsub();
      membersUnsub();
    };
  }, [user]);

  // Sync goal state to form when goal is loaded
  useEffect(() => {
    if (goal) {
      setGoalName(goal.name || '');
      setTargetAmount(goal.targetAmount || '');
      setDeadline(goal.deadline || '');
    }
  }, [goal]);

  // --- Helper Functions ---
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  // --- Computed Data ---
  const totalBalance = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  }, [transactions]);

  // --- Views ---
  const renderDashboard = () => {
    // Calculate goal progress
    let progress = 0;
    let daysRemaining = null;
    let isExpired = false;

    if (goal && goal.targetAmount > 0) {
      progress = Math.min((totalBalance / goal.targetAmount) * 100, 100);
    }

    if (goal && goal.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(goal.deadline);
      const diffTime = deadlineDate - today;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) isExpired = true;
    }

    // Prepare Chart Data
    const monthlyData = {};
    transactions.forEach(tx => {
      const month = tx.date.substring(0, 7); // YYYY-MM
      monthlyData[month] = (monthlyData[month] || 0) + Number(tx.amount);
    });
    
    const chartData = Object.keys(monthlyData)
      .sort()
      .slice(-6) // Last 6 months
      .map(m => {
        const [year, month] = m.split('-');
        const dateObj = new Date(year, month - 1);
        const thMonth = dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
        return { name: thMonth, amount: monthlyData[m] };
      });

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Summary */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
             <DollarSign size={80} />
          </div>
          <p className="text-emerald-100 font-medium mb-1">ยอดเงินกองกลางทั้งหมด</p>
          <h2 className="text-4xl font-bold">{formatMoney(totalBalance)}</h2>
        </div>

        {/* Goal Progress Section */}
        {goal ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Target className="text-orange-500" size={20} />
                <h3 className="font-semibold text-gray-800">เป้าหมาย: {goal.name}</h3>
              </div>
              <span className="text-sm font-medium text-emerald-600">
                {formatMoney(totalBalance)} / {formatMoney(goal.targetAmount)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-sm text-gray-500">
              <span>สำเร็จแล้ว {progress.toFixed(1)}%</span>
              {daysRemaining !== null && (
                <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                  <Clock size={14} /> 
                  {isExpired 
                    ? 'เลยกำหนดเวลาแล้ว' 
                    : daysRemaining === 0 ? 'วันสุดท้าย!' : `เหลือเวลา ${daysRemaining} วัน`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="text-orange-500" size={24} />
              <div>
                <h3 className="font-semibold text-gray-800">ยังไม่มีเป้าหมาย</h3>
                <p className="text-sm text-gray-500">ตั้งเป้าหมายการเก็บเงินเพื่อให้เห็นความคืบหน้า</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('goal')}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
            >
              ตั้งเป้าหมาย
            </button>
          </div>
        )}

        {/* Chart Section */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-blue-500" size={20} />
            <h3 className="font-semibold text-gray-800">สรุปการเก็บเงิน 6 เดือนล่าสุด</h3>
          </div>
          {chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Tooltip 
                    cursor={{fill: '#F3F4F6'}}
                    formatter={(value) => formatMoney(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="amount" name="ยอดเก็บ" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400">
              <PieChart size={32} className="mb-2 opacity-50" />
              <p>ยังไม่มีข้อมูลการเก็บเงิน</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddForm = () => {
    const availableNames = (() => {
      const names = new Set();
      if (transactions) transactions.forEach(tx => tx.name && names.add(tx.name));
      try {
        if (typeof members !== 'undefined' && Array.isArray(members)) {
          members.forEach(m => m.name && names.add(m.name));
        }
      } catch (e) {}
      return Array.from(names).sort();
    })();

    const filteredNames = availableNames.filter(name => 
      name.toLowerCase().includes(addName.toLowerCase())
    );

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!addName.trim() || !addAmount || !addDate || !user) return;
      
      setIsSubmitting(true);
      try {
        const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
        await addDoc(txRef, {
          name: addName.trim(),
          amount: parseFloat(addAmount),
          date: addDate,
          createdAt: new Date().toISOString()
        });
        showNotification('บันทึกการรับเงินเรียบร้อยแล้ว');
        setAddName('');
        setAddAmount('');
        // keep date same to ease multiple entries
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      }
      setIsSubmitting(false);
    };

    return (
      <div className="animate-fade-in max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <PlusCircle className="text-emerald-500" /> บันทึกรับเงิน
        </h2>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้จ่ายเงิน</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <User className="text-gray-400" size={18} />
              </div>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => {
                  setAddName(e.target.value);
                  setShowNameDropdown(true);
                }}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                placeholder="พิมพ์เพื่อค้นหา หรือเลือกจากรายชื่อ..."
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all relative z-0"
                autoComplete="off"
              />
              
              {showNameDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto top-full left-0">
                  {filteredNames.length > 0 ? (
                    filteredNames.map((name, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 hover:bg-emerald-50 cursor-pointer text-gray-700 transition-colors border-b border-gray-50 last:border-b-0"
                        onMouseDown={(e) => {
                          // ใช้ onMouseDown เพื่อให้คลิกติดก่อนที่ input จะสูญเสีย Focus (onBlur)
                          e.preventDefault(); 
                          setAddName(name);
                          setShowNameDropdown(false);
                        }}
                      >
                        {name}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      {!addName ? "ยังไม่มีประวัติรายชื่อในระบบ" : `ไม่พบชื่อ "${addName}" (บันทึกเป็นชื่อใหม่)`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="text-gray-400" size={18} />
              </div>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่จ่าย</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="text-gray-400" size={18} />
              </div>
              <input
                type="date"
                required
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-gray-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-medium text-white transition-all shadow-md flex justify-center items-center gap-2 ${
              isSubmitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg'
            }`}
          >
            {isSubmitting ? 'กำลังบันทึก...' : <><CheckCircle2 size={20} /> บันทึกข้อมูล</>}
          </button>
        </form>
      </div>
    );
  };

  const renderHistory = () => {
    // Generate unique months for filter
    const monthsSet = new Set(transactions.map(tx => tx.date ? tx.date.substring(0, 7) : ''));
    const availableMonths = Array.from(monthsSet).filter(Boolean).sort().reverse(); // YYYY-MM
    
    const filteredTx = selectedMonth === 'all' 
      ? transactions 
      : transactions.filter(tx => tx.date && tx.date.startsWith(selectedMonth));

    const handleDelete = async (id) => {
      // Use standard browser confirmation - WAIT, rules say DO NOT use alert() or confirm().
      // I will implement a simpler inline delete or just perform it directly with a notification.
      // To be safe and compliant, we will just delete it directly with a toast notification to avoid `confirm()`.
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
        showNotification('ลบรายการเรียบร้อยแล้ว');
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาดในการลบ', 'error');
      }
    };

    const formatDisplayDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatMonthOption = (monthStr) => {
      if (monthStr === 'all') return 'ทั้งหมด';
      if (!monthStr || typeof monthStr !== 'string') return '';
      const parts = monthStr.split('-');
      if (parts.length !== 2) return monthStr;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = new Date(y, m - 1);
      return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    };

    return (
      <div className="animate-fade-in">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <List className="text-emerald-500" /> ประวัติการเก็บเงิน
            </h2>
            
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 py-2 px-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            >
              <option value="all">ดูทั้งหมด</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthOption(m)}</option>
              ))}
            </select>
         </div>

         {filteredTx.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
             <List size={48} className="mx-auto text-gray-300 mb-3" />
             <p className="text-gray-500 font-medium">ยังไม่มีรายการเก็บเงินในเดือนนี้</p>
           </div>
         ) : (
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="divide-y divide-gray-100">
               {filteredTx.map(tx => (
                 <div key={tx.id} className="p-4 sm:p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 w-10 h-10 rounded-full flex items-center justify-center text-emerald-600 font-bold shrink-0">
                        {tx.name && typeof tx.name === 'string' ? tx.name.charAt(0) : '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{typeof tx.name === 'string' ? tx.name : 'Unknown'}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                           <Calendar size={12}/> {formatDisplayDate(tx.date)}
                        </p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className="font-bold text-gray-800">{formatMoney(tx.amount)}</span>
                     <button 
                       onClick={() => handleDelete(tx.id)}
                       className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                       title="ลบรายการ"
                     >
                       <Trash2 size={18} />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    );
  };

  const renderGoal = () => {
    const handleSaveGoal = async (e) => {
      e.preventDefault();
      if (!goalName.trim() || !targetAmount || !user) return;
      
      setIsSaving(true);
      try {
        const goalRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'currentGoal');
        await setDoc(goalRef, {
          name: goalName.trim(),
          targetAmount: parseFloat(targetAmount),
          deadline: deadline || null,
          updatedAt: new Date().toISOString()
        });
        showNotification('บันทึกเป้าหมายสำเร็จ');
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาดในการบันทึกเป้าหมาย', 'error');
      }
      setIsSaving(false);
    };

    return (
      <div className="animate-fade-in max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Target className="text-orange-500" /> ตั้งเป้าหมาย
        </h2>

        <form onSubmit={handleSaveGoal} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6 text-sm text-orange-800 flex items-start gap-3">
             <Target className="shrink-0 text-orange-500" size={20} />
             <p>กำหนดเป้าหมายเพื่อเป็นแรงจูงใจในการเก็บเงิน เช่น "ทริปเที่ยวทะเล", "เลี้ยงปาร์ตี้ปีใหม่"</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเป้าหมาย</label>
            <input
              type="text"
              required
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="เช่น ทริปเที่ยวทะเล"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินที่ต้องการ (บาท)</label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="10000"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดเวลา (ไม่บังคับ)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-gray-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className={`w-full py-3 rounded-xl font-medium text-white transition-all shadow-md flex justify-center items-center gap-2 mt-6 ${
              isSaving ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 hover:shadow-lg'
            }`}
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกเป้าหมาย'}
          </button>
        </form>
      </div>
    );
  };

  const renderMembers = () => {
    const handleAddMember = async (e) => {
      e.preventDefault();
      if (!newMemberName.trim() || !user) return;
      
      // Check for duplicate
      if (members.some(m => m.name === newMemberName.trim())) {
        showNotification('มีชื่อนี้ในระบบแล้ว', 'error');
        return;
      }

      setIsAddingMember(true);
      try {
        const membersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'members');
        await addDoc(membersRef, {
          name: newMemberName.trim(),
          createdAt: new Date().toISOString()
        });
        showNotification('เพิ่มรายชื่อสำเร็จ');
        setNewMemberName('');
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาดในการเพิ่มรายชื่อ', 'error');
      }
      setIsAddingMember(false);
    };

    const handleBulkImport = async (e) => {
      e.preventDefault();
      if (!bulkMembers.trim() || !user) return;
      
      const names = bulkMembers.split('\n').map(n => n.trim()).filter(n => n.length > 0);
      if (names.length === 0) return;

      setIsAddingMember(true);
      try {
        const membersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'members');
        let addedCount = 0;
        
        for (const name of names) {
          if (!members.some(m => m.name === name)) {
            await addDoc(membersRef, {
              name: name,
              createdAt: new Date().toISOString()
            });
            addedCount++;
          }
        }
        
        showNotification(`นำเข้าสำเร็จ ${addedCount} รายชื่อ (ข้ามรายชื่อที่ซ้ำ)`);
        setBulkMembers('');
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาดในการนำเข้า', 'error');
      }
      setIsAddingMember(false);
    };

    const handleDeleteMember = async (id) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'members', id));
        showNotification('ลบรายชื่อเรียบร้อยแล้ว');
      } catch (err) {
        console.error(err);
        showNotification('เกิดข้อผิดพลาดในการลบ', 'error');
      }
    };

    return (
      <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-blue-500" /> จัดการรายชื่อสมาชิก
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Single Member */}
          <form onSubmit={handleAddMember} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><User size={18} className="text-blue-500"/> เพิ่มทีละคน</h3>
            <div>
              <input
                type="text"
                required
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="ชื่อ-นามสกุล หรือ ชื่อเล่น"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isAddingMember}
              className={`w-full py-3 rounded-xl font-medium text-white transition-all shadow-md ${
                isAddingMember ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              เพิ่มรายชื่อ
            </button>
          </form>

          {/* Bulk Import */}
          <form onSubmit={handleBulkImport} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Upload size={18} className="text-blue-500"/> นำเข้าจาก Excel</h3>
            <p className="text-xs text-gray-500">คัดลอกรายชื่อจากคอลัมน์ Excel มาวางที่นี่ (1 ชื่อต่อ 1 บรรทัด)</p>
            <div>
              <textarea
                required
                value={bulkMembers}
                onChange={(e) => setBulkMembers(e.target.value)}
                placeholder={"สมชาย ใจดี\nมานี มีใจ\nปิติ น่ารัก"}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isAddingMember}
              className={`w-full py-3 rounded-xl font-medium text-white transition-all shadow-md ${
                isAddingMember ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              นำเข้ารายชื่อทั้งหมด
            </button>
          </form>
        </div>

        {/* Member List */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex justify-between items-center">
            รายชื่อสมาชิกทั้งหมด
            <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">{members.length} คน</span>
          </h3>
          
          {members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ยังไม่มีรายชื่อสมาชิก กรุณาเพิ่มรายชื่อด้านบน
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
              {members.map(m => (
                <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <span className="font-medium text-gray-700 truncate pr-2">{m.name}</span>
                  <button 
                    onClick={() => handleDeleteMember(m.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors shrink-0"
                    title="ลบรายชื่อ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Main Render ---
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">กำลังโหลดข้อมูลห้อง...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex justify-center">
      
      {/* Toast Notification */}
      {notification.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
          <div className={`px-6 py-3 rounded-full shadow-lg text-white font-medium flex items-center gap-2 ${
            notification.type === 'error' ? 'bg-red-500' : 'bg-gray-800'
          }`}>
            {notification.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-2xl bg-gray-50 pb-24 relative shadow-sm">
        
        {/* Top Header */}
        <header className="bg-white px-6 py-4 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-md bg-white/90 shadow-sm flex items-center gap-3">
           <div className="bg-emerald-100 p-2 rounded-xl">
              <DollarSign className="text-emerald-600" size={24} />
           </div>
           <div>
             <h1 className="text-xl font-bold text-gray-800 leading-tight">บันทึกเงินห้อง</h1>
             <p className="text-xs text-gray-500 font-medium">Class Fund Tracker</p>
           </div>
        </header>

        {/* Content Area */}
        <main className="p-4 sm:p-6">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'add' && renderAddForm()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'members' && renderMembers()}
          {activeTab === 'goal' && renderGoal()}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl bg-white border-t border-gray-200 pointer-events-auto shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] pb-safe flex justify-around items-center px-2 py-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center p-2 w-14 sm:w-16 transition-colors ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Home size={22} className={activeTab === 'dashboard' ? 'fill-emerald-100' : ''} />
              <span className="text-[10px] mt-1 font-medium">หน้าหลัก</span>
            </button>
            <button 
              onClick={() => setActiveTab('members')}
              className={`flex flex-col items-center justify-center p-2 w-14 sm:w-16 transition-colors ${activeTab === 'members' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Users size={22} className={activeTab === 'members' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] mt-1 font-medium">รายชื่อ</span>
            </button>
            
            {/* Floating FAB for Add */}
            <div className="relative -top-6">
              <button 
                onClick={() => setActiveTab('add')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-500/30 transform transition-transform active:scale-95 flex items-center justify-center border-4 border-white"
              >
                <PlusCircle size={28} className="fill-emerald-600 text-white" />
              </button>
            </div>

            <button 
              onClick={() => setActiveTab('history')}
              className={`flex flex-col items-center justify-center p-2 w-14 sm:w-16 transition-colors ${activeTab === 'history' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={22} />
              <span className="text-[10px] mt-1 font-medium">ประวัติ</span>
            </button>
            <button 
              onClick={() => setActiveTab('goal')}
              className={`flex flex-col items-center justify-center p-2 w-14 sm:w-16 transition-colors ${activeTab === 'goal' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Target size={22} className={activeTab === 'goal' ? 'fill-orange-100' : ''} />
              <span className="text-[10px] mt-1 font-medium">เป้าหมาย</span>
            </button>
          </div>
        </nav>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in-down { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </div>
  );
}