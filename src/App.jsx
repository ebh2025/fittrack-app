import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Dumbbell, Calendar as CalendarIcon, Settings, TrendingUp, 
  Sun, Moon, Plus, Trash2, Edit2, Check, X, LogOut, ChevronDown, ChevronUp, LineChart, Apple, Upload, Download
} from 'lucide-react';
import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc, updateDoc
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBcCWxLa-KjVXxtTjY-rJdSJC5clFepOoE",
  authDomain: "fittrack-70810.firebaseapp.com",
  projectId: "fittrack-70810",
  storageBucket: "fittrack-70810.firebasestorage.app",
  messagingSenderId: "439569091831",
  appId: "1:439569091831:web:0d5826962ac8245291d7f2",
  measurementId: "G-QKC795JJNJ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "fittrack-app";

// --- Initial Default Data ---
const DEFAULT_EXERCISES = {
  Chest: ["Incline chest press", "Seated chest press", "Seated butterfly", "Bench butterfly"],
  Biceps: ["Hammer", "Seated Incline curl", "Smith seated rod Curl", "Rod biceps curl", "Rope bicep curl"],
  Shoulders: ["Shoulder press", "Lateral raises", "Front raises", "Shrugs", "Rope face pull"],
  Legs: ["Squats", "Leg press", "Romanian deadlift", "Leg extension", "Leg curl", "Calves"],
  Back: ["Deadlift", "Pull over", "Seated rowing", "Bend-over dumbell rowing", "Bend-over barbell rowing"],
  Triceps: ["One-hand tricep pull down", "Tricep pull over", "Tricep pull down rope", "Skull crusher"]
};

// --- Food Database (Per 100g / 1 piece / 1 serving) ---
const FOOD_DB = {
  "Chicken Breast (Raw)": { defaultUnit: "gms", baseQty: 100, macros: { cal: 120, p: 22.5, c: 0, f: 2.6 } },
  "White Rice (Cooked)": { defaultUnit: "gms", baseQty: 100, macros: { cal: 130, p: 2.7, c: 28, f: 0.3 } },
  "Eggs (Whole)": { defaultUnit: "pieces", baseQty: 1, macros: { cal: 70, p: 6, c: 0.6, f: 5 } },
  "Banana": { defaultUnit: "pieces", baseQty: 1, macros: { cal: 105, p: 1.3, c: 27, f: 0.3 } },
  "Whey Protein": { defaultUnit: "servings", baseQty: 1, macros: { cal: 120, p: 24, c: 3, f: 1.5 } },
  "Oats (Dry)": { defaultUnit: "gms", baseQty: 100, macros: { cal: 389, p: 16.9, c: 66.3, f: 6.9 } },
  "Peanut Butter": { defaultUnit: "servings", baseQty: 1, macros: { cal: 190, p: 8, c: 6, f: 16 } },
  "Milk (Whole)": { defaultUnit: "servings", baseQty: 1, macros: { cal: 150, p: 8, c: 12, f: 8 } },
  "Broccoli": { defaultUnit: "gms", baseQty: 100, macros: { cal: 34, p: 2.8, c: 6.6, f: 0.4 } },
  "Almonds": { defaultUnit: "gms", baseQty: 100, macros: { cal: 579, p: 21, c: 21.6, f: 49.9 } },
  "Roti / Chapati": { defaultUnit: "pieces", baseQty: 1, macros: { cal: 120, p: 3.5, c: 22, f: 1.5 } },
  "Paneer (Raw)": { defaultUnit: "gms", baseQty: 100, macros: { cal: 265, p: 18, c: 1.2, f: 20.8 } },
  "Salmon": { defaultUnit: "gms", baseQty: 100, macros: { cal: 208, p: 20, c: 0, f: 13 } },
  "Potato (Boiled)": { defaultUnit: "gms", baseQty: 100, macros: { cal: 87, p: 1.9, c: 20.1, f: 0.1 } }
};

// --- Helper Functions ---
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getWeekString = (dateString) => {
  const d = new Date(dateString);
  const startDate = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - startDate) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((d.getDay() + 1 + days) / 7);
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const getMonthString = (dateString) => {
  return dateString.substring(0, 7); // YYYY-MM
};

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'diet', 'progress', 'config'
  const [loginError, setLoginError] = useState('');
  
  // Data State
  const [exercisesConfig, setExercisesConfig] = useState(DEFAULT_EXERCISES);
  const [logs, setLogs] = useState([]);
  const [dietLogs, setDietLogs] = useState([]);
  
  // Shared Date State (For Log and Diet tabs)
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const logScrollContainerRef = useRef(null);
  const dietScrollContainerRef = useRef(null);

  // Log Tab State
  const [selectedBodyParts, setSelectedBodyParts] = useState([]);
  const [expandedBodyParts, setExpandedBodyParts] = useState({});
  const [setInputs, setSetInputs] = useState({}); // { 'exerciseName': { weight: '', reps: '' } }

  // Diet Tab State
  const [dietInput, setDietInput] = useState({ food: '', quantity: '', unit: 'gms' });
  const [dietGraphMetric, setDietGraphMetric] = useState('calories'); // 'calories', 'protein', 'carbs', 'fat'

  // Custom Foods State
  const [customFoods, setCustomFoods] = useState({});
  const [newFoodInput, setNewFoodInput] = useState({ name: '', unit: 'gms', baseQty: 100, cal: '', p: '', c: '', f: '' });

  // Config Tab State
  const [newExerciseInputs, setNewExerciseInputs] = useState({});
  const [editingExercise, setEditingExercise] = useState(null); // { bodyPart, oldName, newName }

  // Progress Tab State
  const [progressFrequency, setProgressFrequency] = useState('day'); // 'day', 'week', 'month'
  const [progressExercise, setProgressExercise] = useState('');
  const [progressBodyPart, setProgressBodyPart] = useState('');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoginError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Login Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setLoginError("Google Login is blocked in this preview window. Please test it on your live Vercel link, or add 'scf.usercontent.goog' to your Firebase Authorized Domains.");
      } else {
        setLoginError("Failed to login: " + err.message);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    // Fetch Config
    const fetchConfig = async () => {
      const configRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'exercises');
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        setExercisesConfig(docSnap.data().data);
      } else {
        await setDoc(configRef, { data: DEFAULT_EXERCISES });
        setExercisesConfig(DEFAULT_EXERCISES);
      }
    };
    fetchConfig();

    // Fetch Custom Foods
    const fetchFoods = async () => {
      const foodsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'foods');
      const docSnap = await getDoc(foodsRef);
      if (docSnap.exists()) {
        setCustomFoods(docSnap.data().data);
      }
    };
    fetchFoods();

    // Subscribe Logs
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubscribeLogs = onSnapshot(logsRef, 
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        fetchedLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(fetchedLogs);
      },
      (error) => console.error("Error fetching logs:", error)
    );

    // Subscribe Diet Logs
    const dietLogsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'dietLogs');
    const unsubscribeDietLogs = onSnapshot(dietLogsRef, 
      (snapshot) => {
        const fetchedDietLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        fetchedDietLogs.sort((a, b) => b.timestamp - a.timestamp);
        setDietLogs(fetchedDietLogs);
      },
      (error) => console.error("Error fetching diet logs:", error)
    );

    return () => { unsubscribeLogs(); unsubscribeDietLogs(); };
  }, [user]);

  // Scroll to selected date on tab change or date change
  useEffect(() => {
    if (activeTab === 'log' && logScrollContainerRef.current) {
      const activeEl = logScrollContainerRef.current.querySelector('.selected-date');
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    if (activeTab === 'diet' && dietScrollContainerRef.current) {
      const activeEl = dietScrollContainerRef.current.querySelector('.selected-date');
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate, activeTab]);

  // --- Derived Data ---
  const allBodyParts = Object.keys(exercisesConfig);
  
  const currentDayLogs = useMemo(() => {
    return logs.filter(log => log.date === selectedDate);
  }, [logs, selectedDate]);

  const currentDayDietLogs = useMemo(() => {
    return dietLogs.filter(log => log.date === selectedDate);
  }, [dietLogs, selectedDate]);

  const dailyMacros = useMemo(() => {
    const raw = currentDayDietLogs.reduce((acc, log) => ({
      cal: acc.cal + (log.calories || 0),
      p: acc.p + (log.protein || 0),
      c: acc.c + (log.carbs || 0),
      f: acc.f + (log.fat || 0)
    }), { cal: 0, p: 0, c: 0, f: 0 });
    
    return {
      cal: Math.round(raw.cal),
      p: Math.round(raw.p * 10) / 10,
      c: Math.round(raw.c * 10) / 10,
      f: Math.round(raw.f * 10) / 10
    };
  }, [currentDayDietLogs]);

  const combinedFoods = useMemo(() => ({ ...FOOD_DB, ...customFoods }), [customFoods]);

  const dietGraphData = useMemo(() => {
    const grouped = {};
    dietLogs.forEach(log => {
      const date = log.date;
      if (!grouped[date]) {
        grouped[date] = { calories: 0, protein: 0, carbs: 0, fat: 0, dateLabel: date };
      }
      grouped[date].calories += log.calories || 0;
      grouped[date].protein += log.protein || 0;
      grouped[date].carbs += log.carbs || 0;
      grouped[date].fat += log.fat || 0;
    });
    return Object.values(grouped).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  }, [dietLogs]);

  const dateList = useMemo(() => {
    const dates = [];
    const today = new Date();
    // Generate dates from 60 days ago to 14 days in the future
    for (let i = -60; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // --- Handlers: Logging ---
  const toggleBodyPartSelection = (part) => {
    setSelectedBodyParts(prev => 
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
    if (!selectedBodyParts.includes(part)) {
      setExpandedBodyParts(prev => ({ ...prev, [part]: true }));
    }
  };

  const toggleBodyPartExpansion = (part) => {
    setExpandedBodyParts(prev => ({ ...prev, [part]: !prev[part] }));
  };

  const handleSetInputChange = (exercise, field, value) => {
    setSetInputs(prev => ({
      ...prev,
      [exercise]: {
        ...(prev[exercise] || { weight: '', reps: '' }),
        [field]: value
      }
    }));
  };

  const handleAddSet = async (bodyPart, exercise) => {
    const input = setInputs[exercise];
    if (!input || !input.weight || !input.reps) return;

    const newLog = {
      date: selectedDate,
      bodyPart,
      exercise,
      weight: parseFloat(input.weight),
      reps: parseInt(input.reps, 10),
      timestamp: Date.now()
    };

    try {
      const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
      await addDoc(logsRef, newLog);
      setSetInputs(prev => ({ ...prev, [exercise]: { weight: '', reps: '' } }));
    } catch (err) {
      console.error("Error adding log:", err);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', logId));
    } catch (err) {
      console.error("Error deleting log:", err);
    }
  };

  // --- Handlers: Diet ---
  const handleFoodSelection = (e) => {
    const foodName = e.target.value;
    const foodData = combinedFoods[foodName];
    setDietInput(prev => ({
      ...prev,
      food: foodName,
      unit: foodData ? foodData.defaultUnit : 'gms'
    }));
  };

  const handleAddDietLog = async () => {
    if (!dietInput.food || !dietInput.quantity) return;

    const foodData = combinedFoods[dietInput.food];
    const qty = parseFloat(dietInput.quantity);
    
    let macros = { cal: 0, p: 0, c: 0, f: 0 };
    
    // Calculate macros based on quantity vs baseQty
    if (foodData && !isNaN(qty)) {
      const factor = qty / foodData.baseQty;
      macros = {
        cal: Math.round(foodData.macros.cal * factor),
        p: Math.round(foodData.macros.p * factor * 10) / 10,
        c: Math.round(foodData.macros.c * factor * 10) / 10,
        f: Math.round(foodData.macros.f * factor * 10) / 10,
      };
    }

    const newDietLog = {
      date: selectedDate,
      foodName: dietInput.food,
      quantity: qty,
      unit: dietInput.unit,
      calories: macros.cal,
      protein: macros.p,
      carbs: macros.c,
      fat: macros.f,
      timestamp: Date.now()
    };

    try {
      const dietLogsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'dietLogs');
      await addDoc(dietLogsRef, newDietLog);
      setDietInput({ food: '', quantity: '', unit: 'gms' });
    } catch (err) {
      console.error("Error adding diet log:", err);
    }
  };

  const handleDeleteDietLog = async (logId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dietLogs', logId));
    } catch (err) {
      console.error("Error deleting diet log:", err);
    }
  };

  // --- Handlers: Configuration ---
  const saveConfigToDb = async (newConfig) => {
    try {
      const configRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'exercises');
      await setDoc(configRef, { data: newConfig });
      setExercisesConfig(newConfig);
    } catch (err) {
      console.error("Error saving config:", err);
    }
  };

  const handleAddNewExercise = (bodyPart) => {
    const val = newExerciseInputs[bodyPart];
    if (!val || val.trim() === '') return;
    
    const newConfig = { ...exercisesConfig };
    if (!newConfig[bodyPart]) newConfig[bodyPart] = [];
    if (!newConfig[bodyPart].includes(val.trim())) {
      newConfig[bodyPart] = [...newConfig[bodyPart], val.trim()];
      saveConfigToDb(newConfig);
    }
    setNewExerciseInputs(prev => ({ ...prev, [bodyPart]: '' }));
  };

  const handleDeleteExercise = (bodyPart, exerciseName) => {
    const newConfig = { ...exercisesConfig };
    newConfig[bodyPart] = newConfig[bodyPart].filter(e => e !== exerciseName);
    saveConfigToDb(newConfig);
  };

  const handleSaveEditExercise = () => {
    if (!editingExercise || !editingExercise.newName.trim()) return;
    const { bodyPart, oldName, newName } = editingExercise;
    
    const newConfig = { ...exercisesConfig };
    const index = newConfig[bodyPart].indexOf(oldName);
    if (index !== -1) {
      newConfig[bodyPart][index] = newName.trim();
      saveConfigToDb(newConfig);
    }
    setEditingExercise(null);
  };

  // --- Handlers: Custom Foods ---
  const saveFoodsToDb = async (newFoods) => {
    try {
      const foodsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'foods');
      await setDoc(foodsRef, { data: newFoods });
      setCustomFoods(newFoods);
    } catch (err) {
      console.error("Error saving foods:", err);
    }
  };

  const handleAddCustomFood = () => {
    if (!newFoodInput.name.trim()) return;
    const newFoods = { ...customFoods };
    newFoods[newFoodInput.name.trim()] = {
      defaultUnit: newFoodInput.unit,
      baseQty: parseFloat(newFoodInput.baseQty) || 100,
      macros: {
        cal: parseFloat(newFoodInput.cal) || 0,
        p: parseFloat(newFoodInput.p) || 0,
        c: parseFloat(newFoodInput.c) || 0,
        f: parseFloat(newFoodInput.f) || 0
      }
    };
    saveFoodsToDb(newFoods);
    setNewFoodInput({ name: '', unit: 'gms', baseQty: 100, cal: '', p: '', c: '', f: '' });
  };

  const handleDeleteCustomFood = (foodName) => {
    const newFoods = { ...customFoods };
    delete newFoods[foodName];
    saveFoodsToDb(newFoods);
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n');
      const newFoods = { ...customFoods };
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [name, unit, baseQty, cal, p, c, f] = line.split(',');
        if (name) {
          newFoods[name.trim()] = {
            defaultUnit: unit?.trim() || 'gms',
            baseQty: parseFloat(baseQty) || 100,
            macros: {
              cal: parseFloat(cal) || 0,
              p: parseFloat(p) || 0,
              c: parseFloat(c) || 0,
              f: parseFloat(f) || 0
            }
          };
        }
      }
      saveFoodsToDb(newFoods);
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,FoodName,Unit,BaseQty,Calories,Protein,Carbs,Fat\nCustom Apple,pieces,1,95,0.5,25,0.3\nCustom Chicken,gms,100,165,31,0,3.6";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "food_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- UI Renderers ---
  const renderHorizontalDatePicker = (ref) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Selected Date</label>
        <div className="flex items-center text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
          <CalendarIcon className="w-4 h-4 mr-1.5" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs bg-transparent border-none font-semibold outline-none cursor-pointer text-blue-600 dark:text-blue-400 w-auto"
          />
        </div>
      </div>
      
      <div 
        ref={ref} 
        className="flex overflow-x-auto space-x-3 pb-2 -mx-2 px-2 scrollbar-hide snap-x"
      >
        {dateList.map(dateObj => {
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = dateObj.getDate();
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-[60px] h-[72px] rounded-2xl border snap-center transition-all duration-200 ${
                  isSelected 
                  ? 'selected-date bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/30 transform scale-105' 
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isSelected ? 'opacity-90' : 'opacity-60'}`}>
                  {dayName}
                </span>
                <span className="text-xl font-bold leading-none">{dayNum}</span>
              </button>
            )
        })}
      </div>
    </div>
  );

  const renderLogTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {renderHorizontalDatePicker(logScrollContainerRef)}

      {/* Body Part Selection */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Target Muscles Today</label>
        <div className="flex flex-wrap gap-2">
          {allBodyParts.map(part => {
            const isSelected = selectedBodyParts.includes(part);
            return (
              <button
                key={part}
                onClick={() => toggleBodyPartSelection(part)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isSelected 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {part}
              </button>
            )
          })}
        </div>
      </div>

      {/* Exercises for Selected Body Parts */}
      <div className="space-y-4">
        {selectedBodyParts.map(part => (
          <div key={part} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div 
              className="flex justify-between items-center p-4 cursor-pointer bg-slate-50 dark:bg-slate-800/50"
              onClick={() => toggleBodyPartExpansion(part)}
            >
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{part} Workout</h3>
              {expandedBodyParts[part] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
            
            {expandedBodyParts[part] && (
              <div className="p-4 space-y-6">
                {exercisesConfig[part]?.map(exercise => {
                  const exerciseLogs = currentDayLogs.filter(l => l.exercise === exercise);
                  const inputs = setInputs[exercise] || { weight: '', reps: '' };

                  return (
                    <div key={exercise} className="border-b border-slate-100 dark:border-slate-700 last:border-0 pb-6 last:pb-0">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center">
                        <Dumbbell className="w-4 h-4 mr-2 text-blue-500" />
                        {exercise}
                      </h4>
                      
                      {/* Add Set Form */}
                      <div className="flex items-end gap-2 mb-4">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-1">Weight (kg)</label>
                          <input 
                            type="number" 
                            placeholder="0"
                            value={inputs.weight}
                            onChange={(e) => handleSetInputChange(exercise, 'weight', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-1">Reps</label>
                          <input 
                            type="number" 
                            placeholder="0"
                            value={inputs.reps}
                            onChange={(e) => handleSetInputChange(exercise, 'reps', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <button 
                          onClick={() => handleAddSet(part, exercise)}
                          disabled={!inputs.weight || !inputs.reps}
                          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors h-[42px] flex items-center justify-center w-[42px]"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Logged Sets Display */}
                      {exerciseLogs.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 space-y-2">
                          {exerciseLogs.map((log, idx) => (
                            <div key={log.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center space-x-3">
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Set {idx + 1}</span>
                                <span className="text-sm font-medium dark:text-slate-200">{log.weight} kg × {log.reps} reps</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-red-400 hover:text-red-500 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {selectedBodyParts.length === 0 && (
          <div className="text-center p-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
            <Dumbbell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Select a muscle group above to start logging exercises.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderDietTab = () => {
    // Diet Graph Properties Setup
    const maxMetricValue = dietGraphData.length > 0 
      ? Math.max(...dietGraphData.map(d => d[dietGraphMetric])) 
      : 0;

    const metricColors = {
      calories: 'bg-slate-500',
      protein: 'bg-blue-500',
      carbs: 'bg-amber-500',
      fat: 'bg-red-500'
    };
    
    const metricLabels = {
      calories: 'kcal',
      protein: 'g',
      carbs: 'g',
      fat: 'g'
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHorizontalDatePicker(dietScrollContainerRef)}

        {/* Daily Macros Summary */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center">
            <Apple className="w-5 h-5 mr-2 text-green-500" /> Daily Macros
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">Cals</div>
              <div className="font-bold text-lg text-slate-800 dark:text-slate-200">{dailyMacros.cal}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-100 dark:border-blue-800/50">
              <div className="text-xs text-blue-500 dark:text-blue-400 mb-1 font-semibold">Pro (g)</div>
              <div className="font-bold text-lg text-blue-700 dark:text-blue-300">{dailyMacros.p}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-100 dark:border-amber-800/50">
              <div className="text-xs text-amber-500 dark:text-amber-400 mb-1 font-semibold">Carbs</div>
              <div className="font-bold text-lg text-amber-700 dark:text-amber-300">{dailyMacros.c}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-100 dark:border-red-800/50">
              <div className="text-xs text-red-500 dark:text-red-400 mb-1 font-semibold">Fat</div>
              <div className="font-bold text-lg text-red-700 dark:text-red-300">{dailyMacros.f}</div>
            </div>
          </div>
        </div>

        {/* Add Food Form */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Add Food Item</label>
          <div className="space-y-3">
            <select 
              value={dietInput.food} 
              onChange={handleFoodSelection}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="">-- Select Food --</option>
              {Object.keys(combinedFoods).sort().map(food => (
                <option key={food} value={food}>{food}</option>
              ))}
            </select>
            
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Quantity"
                value={dietInput.quantity}
                onChange={(e) => setDietInput(prev => ({...prev, quantity: e.target.value}))}
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white outline-none"
              />
              <select 
                value={dietInput.unit} 
                onChange={(e) => setDietInput(prev => ({...prev, unit: e.target.value}))}
                className="w-[100px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white outline-none"
              >
                <option value="gms">gms</option>
                <option value="servings">servings</option>
                <option value="pieces">pieces</option>
              </select>
              <button 
                onClick={handleAddDietLog}
                disabled={!dietInput.food || !dietInput.quantity}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors flex items-center justify-center w-[46px]"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Logged Foods Display */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Meals Logged Today</h3>
          </div>
          <div className="p-4 space-y-3 h-64 overflow-y-auto">
            {currentDayDietLogs.length > 0 ? (
              currentDayDietLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{log.foodName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {log.quantity} {log.unit} • {log.calories} kcal
                    </div>
                    <div className="flex space-x-2 mt-1 text-[10px] font-medium">
                      <span className="text-blue-500">P: {log.protein}g</span>
                      <span className="text-amber-500">C: {log.carbs}g</span>
                      <span className="text-red-500">F: {log.fat}g</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteDietLog(log.id)}
                    className="text-red-400 hover:text-red-500 p-2 ml-2 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-100 dark:border-slate-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
               <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                 No food logged yet.
               </div>
            )}
          </div>
        </div>

        {/* Diet Trends Graph */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between">
            <span className="flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-slate-500" /> Diet Trends</span>
          </h3>
          
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-6">
            {[
              { id: 'calories', label: 'Cals' },
              { id: 'protein', label: 'Pro' },
              { id: 'carbs', label: 'Carbs' },
              { id: 'fat', label: 'Fat' }
            ].map(metric => (
              <button
                key={metric.id}
                onClick={() => setDietGraphMetric(metric.id)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  dietGraphMetric === metric.id 
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>

          {dietGraphData.length > 0 ? (
            <div className="space-y-4">
              {dietGraphData.map((data, idx) => {
                const val = data[dietGraphMetric];
                const barWidth = maxMetricValue > 0 ? `${(val / maxMetricValue) * 100}%` : '0%';
                const colorClass = metricColors[dietGraphMetric];
                
                return (
                  <div key={idx} className="relative">
                    <div className="flex justify-between text-xs mb-1 text-slate-500 dark:text-slate-400">
                      <span>{data.dateLabel}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {Math.round(val)} {metricLabels[dietGraphMetric]}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`${colorClass} h-full rounded-full transition-all duration-1000 ease-out`} 
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <LineChart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No dietary data found.</p>
            </div>
          )}
        </div>

      </div>
    );
  };

  const renderConfigTab = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
        <h2 className="text-blue-800 dark:text-blue-300 font-bold flex items-center">
          <Settings className="w-5 h-5 mr-2" /> Manage Exercises
        </h2>
        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Customize the list of exercises for each muscle group. These will appear in your logging tab.</p>
      </div>

      {allBodyParts.map(part => (
        <div key={part} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white">{part}</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2 mb-4">
              {exercisesConfig[part]?.map(exercise => (
                <li key={exercise} className="flex justify-between items-center group">
                  {editingExercise?.bodyPart === part && editingExercise?.oldName === exercise ? (
                    <div className="flex flex-1 items-center space-x-2">
                      <input 
                        type="text" 
                        value={editingExercise.newName}
                        onChange={(e) => setEditingExercise({...editingExercise, newName: e.target.value})}
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded p-1.5 text-sm dark:text-white outline-none"
                        autoFocus
                      />
                      <button onClick={handleSaveEditExercise} className="text-green-500 p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check className="w-4 h-4"/></button>
                      <button onClick={() => setEditingExercise(null)} className="text-slate-400 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{exercise}</span>
                      <div className="flex space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingExercise({ bodyPart: part, oldName: exercise, newName: exercise })}
                          className="text-slate-400 hover:text-blue-500 p-1.5"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExercise(part, exercise)}
                          className="text-slate-400 hover:text-red-500 p-1.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                placeholder="Add new exercise..."
                value={newExerciseInputs[part] || ''}
                onChange={(e) => setNewExerciseInputs(prev => ({ ...prev, [part]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewExercise(part)}
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
              <button 
                onClick={() => handleAddNewExercise(part)}
                className="bg-slate-800 dark:bg-slate-600 text-white p-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* --- Custom Foods Management --- */}
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/50 mt-8">
        <h2 className="text-green-800 dark:text-green-300 font-bold flex items-center">
          <Apple className="w-5 h-5 mr-2" /> Manage Custom Foods
        </h2>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">Add your own food items or bulk upload via CSV.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden p-4">
        
        <div className="flex gap-2 mb-6">
           <button 
             onClick={downloadTemplate}
             className="flex-1 flex justify-center items-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
           >
             <Download className="w-4 h-4 mr-2" /> Template
           </button>
           <label className="flex-1 flex justify-center items-center bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-blue-200 dark:border-blue-800">
             <Upload className="w-4 h-4 mr-2" /> Upload CSV
             <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
           </label>
        </div>

        <div className="space-y-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-6">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">Add Individual Food</h3>
          <input type="text" placeholder="Food Name" value={newFoodInput.name} onChange={e => setNewFoodInput({...newFoodInput, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none" />
          
          <div className="flex gap-2">
            <input type="number" placeholder="Base Qty" value={newFoodInput.baseQty} onChange={e => setNewFoodInput({...newFoodInput, baseQty: e.target.value})} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none" />
            <select value={newFoodInput.unit} onChange={e => setNewFoodInput({...newFoodInput, unit: e.target.value})} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none">
              <option value="gms">gms</option>
              <option value="servings">servings</option>
              <option value="pieces">pieces</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-2">
             <input type="number" placeholder="Cals" value={newFoodInput.cal} onChange={e => setNewFoodInput({...newFoodInput, cal: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none" />
             <input type="number" placeholder="Pro" value={newFoodInput.p} onChange={e => setNewFoodInput({...newFoodInput, p: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none" />
             <input type="number" placeholder="Carb" value={newFoodInput.c} onChange={e => setNewFoodInput({...newFoodInput, c: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none" />
             <input type="number" placeholder="Fat" value={newFoodInput.f} onChange={e => setNewFoodInput({...newFoodInput, f: e.target.value})} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none" />
          </div>

          <button onClick={handleAddCustomFood} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
             Save Custom Food
          </button>
        </div>

        <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-3">Your Custom Foods</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {Object.keys(customFoods).length > 0 ? Object.entries(customFoods).map(([food, data]) => (
             <div key={food} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                  <div className="text-sm font-semibold dark:text-slate-200">{food}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {data.baseQty}{data.defaultUnit} • {data.macros.cal}kcal
                  </div>
                </div>
                <button onClick={() => handleDeleteCustomFood(food)} className="text-slate-400 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
          )) : <p className="text-xs text-slate-500 italic">No custom foods added.</p>}
        </div>

      </div>

    </div>
  );

  const renderProgressTab = () => {
    // Available exercises based on selection
    const availableExercises = progressBodyPart === 'All' 
      ? Object.values(exercisesConfig).flat().sort()
      : (exercisesConfig[progressBodyPart] || []);

    // Reusable chart renderer for a single exercise
    const renderChartForExercise = (exName) => {
      const exerciseLogs = logs.filter(l => l.exercise === exName);
      if (exerciseLogs.length === 0) return null;

      const groupedData = {};
      exerciseLogs.forEach(log => {
        let key;
        if (progressFrequency === 'day') key = log.date;
        else if (progressFrequency === 'week') key = getWeekString(log.date);
        else key = getMonthString(log.date);

        if (!groupedData[key]) {
          groupedData[key] = { maxWeight: 0, totalReps: 0, dateLabel: key };
        }
        if (log.weight > groupedData[key].maxWeight) {
          groupedData[key].maxWeight = log.weight;
        }
        groupedData[key].totalReps += log.reps;
      });

      const chartData = Object.values(groupedData).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
      const maxChartWeight = chartData.length > 0 ? Math.max(...chartData.map(d => d.maxWeight)) : 0;

      return (
        <div key={exName} className="mt-4 first:mt-0 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 shadow-inner">
          <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">{exName}</h4>
          <div className="space-y-4">
            {chartData.map((data, idx) => {
              const barWidth = maxChartWeight > 0 ? `${(data.maxWeight / maxChartWeight) * 100}%` : '0%';
              return (
                <div key={idx} className="relative">
                  <div className="flex justify-between text-xs mb-1 text-slate-500 dark:text-slate-400">
                    <span>{data.dateLabel}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{data.maxWeight} kg</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: barWidth }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Aggregate rendered charts based on selection
    let chartsRendered = [];
    if (progressExercise === 'All') {
      chartsRendered = availableExercises.map(ex => renderChartForExercise(ex)).filter(chart => chart !== null);
    } else if (progressExercise) {
      const chart = renderChartForExercise(progressExercise);
      if (chart) chartsRendered.push(chart);
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Track Progression</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Select Muscle Group</label>
              <select 
                value={progressBodyPart} 
                onChange={(e) => {
                  setProgressBodyPart(e.target.value);
                  setProgressExercise(''); // Reset exercise when part changes
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
              >
                <option value="">-- Select --</option>
                <option value="All">All Muscle Groups</option>
                {allBodyParts.map(part => <option key={part} value={part}>{part}</option>)}
              </select>
            </div>

            {progressBodyPart && (
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Select Exercise</label>
                <select 
                  value={progressExercise} 
                  onChange={(e) => setProgressExercise(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                >
                  <option value="">-- Select --</option>
                  {progressBodyPart !== 'All' && <option value="All">All Exercises</option>}
                  {availableExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Timeframe</label>
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {['day', 'week', 'month'].map(freq => (
                  <button
                    key={freq}
                    onClick={() => setProgressFrequency(freq)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                      progressFrequency === freq 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        {progressExercise ? (
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-6 flex justify-between items-center">
              <span>Max Weight Over Time</span>
            </h3>

            {chartsRendered.length > 0 ? (
              <div className="space-y-4">
                {chartsRendered}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <LineChart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No log data found for the selected exercises.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
            Select a muscle group and exercise to view progression charts.
          </div>
        )}
      </div>
    );
  };

  // --- Main Layout ---
  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
        <div className="animate-spin text-blue-500"><Dumbbell className="w-8 h-8" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${darkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-5 font-sans">
          <Dumbbell className="w-16 h-16 text-blue-500 mb-4" />
          <h1 className="text-3xl font-black mb-2 text-slate-800 dark:text-white">FitTrack<span className="text-blue-500">Pro</span></h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 text-center">Your personal fitness and nutrition companion.</p>
          
          <button 
            onClick={handleGoogleLogin}
            className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all text-slate-700 dark:text-slate-200"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25C22.56 11.47 22.49 10.73 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.8 15.71 17.58V20.33H19.28C21.36 18.41 22.56 15.58 22.56 12.25Z" fill="#4285F4"/>
              <path d="M12 23C14.97 23 17.46 22.02 19.28 20.33L15.71 17.58C14.73 18.24 13.48 18.63 12 18.63C9.13 18.63 6.7 16.69 5.82 14.08H2.13V16.94C3.95 20.55 7.68 23 12 23Z" fill="#34A853"/>
              <path d="M5.82 14.08C5.59 13.41 5.46 12.72 5.46 12C5.46 11.28 5.59 10.59 5.82 9.92V7.06H2.13C1.38 8.56 0.95 10.23 0.95 12C0.95 13.77 1.38 15.44 2.13 16.94L5.82 14.08Z" fill="#FBBC05"/>
              <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.01L19.36 3.85C17.46 2.08 14.97 1 12 1C7.68 1 3.95 3.45 2.13 7.06L5.82 9.92C6.7 7.31 9.13 5.38 12 5.38Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {loginError && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 text-center max-w-sm">
              <span className="font-bold">Security Blocked:</span> {loginError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
        
        {/* Header */}
        <header className="px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-500 p-1.5 rounded-lg text-white">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">FitTrack<span className="text-blue-500">Pro</span></h1>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* User Info Bar */}
        <div className="px-5 py-2 bg-slate-100 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50">
           <span className="truncate pr-4 flex items-center">
             {user?.photoURL && <img src={user.photoURL} alt="avatar" className="w-5 h-5 rounded-full mr-2" />}
             {user?.email || `User: ${user?.uid.slice(0,6)}...`}
           </span>
           <button onClick={() => signOut(auth)} className="flex items-center text-red-500 font-medium hover:text-red-600">
             <LogOut className="w-3 h-3 mr-1" />
             Sign Out
           </button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-5 pb-24">
          {activeTab === 'log' && renderLogTab()}
          {activeTab === 'diet' && renderDietTab()}
          {activeTab === 'progress' && renderProgressTab()}
          {activeTab === 'config' && renderConfigTab()}
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-2 py-3 flex justify-between items-center z-20 pb-safe">
          <button 
            onClick={() => setActiveTab('log')}
            className={`flex-1 flex flex-col items-center p-2 transition-colors ${activeTab === 'log' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <CalendarIcon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-semibold">Log</span>
          </button>
          <button 
            onClick={() => setActiveTab('diet')}
            className={`flex-1 flex flex-col items-center p-2 transition-colors ${activeTab === 'diet' ? 'text-green-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Apple className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-semibold">Diet</span>
          </button>
          <button 
            onClick={() => setActiveTab('progress')}
            className={`flex-1 flex flex-col items-center p-2 transition-colors ${activeTab === 'progress' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <TrendingUp className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-semibold">Progress</span>
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex-1 flex flex-col items-center p-2 transition-colors ${activeTab === 'config' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-semibold">Config</span>
          </button>
        </nav>

        {/* Global Styles for Safe Area on Mobile Apps */}
        <style dangerouslySetInnerHTML={{__html: `
          .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </div>
    </div>
  );
}