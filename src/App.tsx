import React, { useState, useRef, useEffect } from "react";
import { 
  Smartphone, 
  Check, 
  Upload, 
  Plus, 
  Trash2, 
  BookOpen, 
  Users, 
  CheckSquare, 
  Camera, 
  Sparkles, 
  FileText, 
  RefreshCw, 
  Download, 
  School, 
  HelpCircle,
  FileSpreadsheet,
  AlertCircle,
  Award,
  ArrowRight,
  Copy,
  Share2,
  Monitor
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Firebase imports
import { auth, db, googleProvider, signInWithPopup, signOut } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  writeBatch
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firebaseUtils";

// Types
interface ClassRoom {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
  studentCount: number;
}

interface Student {
  id: string;
  name: string;
}

interface AnswerKey {
  questionNumber: number;
  correctAnswer: "A" | "B" | "C" | "D" | "E" | "";
}

interface GradedResult {
  studentName: string;
  studentAnswers: string[];
  score: number;
  correctCount: number;
  totalQuestions: number;
  aiFeedback: string;
  mode: string;
  message?: string;
}

export default function App() {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"salas" | "importar" | "gabarito" | "corrigir">("corrigir");

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // State
  const [classes, setClasses] = useState<ClassRoom[]>([
    { id: "1", name: "9º Ano A", subject: "Matemática", createdAt: "2026-06-28", studentCount: 24 },
    { id: "2", name: "3º Ano EM", subject: "Português", createdAt: "2026-06-29", studentCount: 31 },
    { id: "3", name: "1º Ano B", subject: "História", createdAt: "2026-06-30", studentCount: 18 },
  ]);

  const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({
    "1": [
      { id: "s1", name: "Ana Beatriz Oliveira" },
      { id: "s2", name: "Carlos Eduardo Costa" },
      { id: "s3", name: "Diana Santos Rocha" },
      { id: "s4", name: "Felipe Augusto Souza" },
      { id: "s5", name: "Gabriela Mendes Silva" },
    ],
    "2": [
      { id: "s2-1", name: "Arthur Ribeiro" },
      { id: "s2-2", name: "Beatriz Nogueira" },
      { id: "s2-3", name: "Caio Ferreira" },
    ],
    "3": [
      { id: "s3-1", name: "Daniela Alencar" },
      { id: "s3-2", name: "Eduardo Fonseca" },
    ],
  });

  const [selectedClassId, setSelectedClassId] = useState<string>("1");
  const [newClassName, setNewClassName] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");

  // AI Import State
  const [rawStudentsText, setRawStudentsText] = useState(
    "1 - Ana Beatriz Oliveira\nCarlos Eduardo Costa (transferido)\n03. Diana Santos Rocha\nFelipe Augusto Souza - OK\nGABRIELA MENDES SILVA"
  );
  const [isProcessingStudents, setIsProcessingStudents] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<string[]>([]);
  const [targetClassForImport, setTargetClassForImport] = useState("1");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Official Answer Key State
  const [numQuestions, setNumQuestions] = useState<5 | 10 | 15 | 20>(10);
  const [officialKey, setOfficialKey] = useState<AnswerKey[]>([
    { questionNumber: 1, correctAnswer: "A" },
    { questionNumber: 2, correctAnswer: "B" },
    { questionNumber: 3, correctAnswer: "C" },
    { questionNumber: 4, correctAnswer: "A" },
    { questionNumber: 5, correctAnswer: "D" },
    { questionNumber: 6, correctAnswer: "E" },
    { questionNumber: 7, correctAnswer: "B" },
    { questionNumber: 8, correctAnswer: "C" },
    { questionNumber: 9, correctAnswer: "A" },
    { questionNumber: 10, correctAnswer: "E" },
  ]);

  // Grader State
  const [graderStudentName, setGraderStudentName] = useState("Matheus Lima");
  const [studentKey, setStudentKey] = useState<Record<number, "A" | "B" | "C" | "D" | "E" | "">>({
    1: "A", 2: "B", 3: "D", 4: "A", 5: "D",
    6: "E", 7: "A", 8: "C", 9: "A", 10: "D"
  });
  const [isGrading, setIsGrading] = useState(false);
  const [gradedResult, setGradedResult] = useState<GradedResult | null>(null);
  const [historicResults, setHistoricResults] = useState<GradedResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showApkInstructions, setShowApkInstructions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Access control & Admin states
  const [adminPin, setAdminPin] = useState("5074");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [changingPin, setChangingPin] = useState(false);
  
  // Custom link states inside admin
  const [pcLinkInput, setPcLinkInput] = useState("");
  const [shareLinkInput, setShareLinkInput] = useState("");
  
  // Custom APK states
  const [customApkInfo, setCustomApkInfo] = useState<{
    customApkExists: boolean;
    originalName?: string;
    size?: number;
    uploadedAt?: string;
  } | null>(null);
  const [apkUploading, setApkUploading] = useState(false);
  const [apkError, setApkError] = useState("");
  const [apkSuccess, setApkSuccess] = useState("");

  // App Settings States (PC Link, Share Link)
  const [pcLink, setPcLink] = useState("https://gabarito-ia-prof.base44.app/login");
  const [shareLink, setShareLink] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Fetch App Settings
  const fetchAppSettings = async () => {
    try {
      const res = await fetch("/api/app-settings");
      const contentType = res.headers.get("Content-Type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.pcLink) setPcLink(data.pcLink);
        if (data.shareLink !== undefined) setShareLink(data.shareLink);
        localStorage.setItem("local_app_settings", JSON.stringify(data));
      } else {
        const local = localStorage.getItem("local_app_settings");
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.pcLink) setPcLink(parsed.pcLink);
          if (parsed.shareLink !== undefined) setShareLink(parsed.shareLink);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar configurações globais (usando local):", err);
      const local = localStorage.getItem("local_app_settings");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed.pcLink) setPcLink(parsed.pcLink);
          if (parsed.shareLink !== undefined) setShareLink(parsed.shareLink);
        } catch (_) {}
      }
    }
  };

  const handleSaveAppSettings = async (newPc: string, newShare: string) => {
    setIsSavingSettings(true);
    setSettingsSuccess("");
    setSettingsError("");
    
    // Optimistic / Local sync
    setPcLink(newPc);
    setShareLink(newShare);
    const mockSettings = { pcLink: newPc, shareLink: newShare };
    localStorage.setItem("local_app_settings", JSON.stringify(mockSettings));
    
    try {
      const res = await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockSettings)
      });
      const contentType = res.headers.get("Content-Type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        setSettingsSuccess("Links salvos e atualizados com sucesso!");
        setTimeout(() => setSettingsSuccess(""), 4000);
      } else {
        setSettingsSuccess("Salvo localmente no navegador!");
        setTimeout(() => setSettingsSuccess(""), 4000);
      }
    } catch (err: any) {
      console.warn("Erro ao enviar configurações ao servidor, mantido localmente:", err);
      setSettingsSuccess("Salvo localmente no navegador!");
      setTimeout(() => setSettingsSuccess(""), 4000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Fetch custom APK info
  const fetchCustomApkInfo = async () => {
    try {
      const res = await fetch("/api/custom-apk-info");
      const contentType = res.headers.get("Content-Type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setCustomApkInfo(data);
        // Sync to localStorage as backup
        localStorage.setItem("local_custom_apk_meta", JSON.stringify(data));
      } else {
        // If the server doesn't respond with JSON (e.g., static deploy or error)
        // load from localStorage if available
        const localMeta = localStorage.getItem("local_custom_apk_meta");
        if (localMeta) {
          setCustomApkInfo(JSON.parse(localMeta));
        }
      }
    } catch (err) {
      console.error("Erro ao buscar informações do APK customizado:", err);
      // Fallback to localStorage
      const localMeta = localStorage.getItem("local_custom_apk_meta");
      if (localMeta) {
        try {
          setCustomApkInfo(JSON.parse(localMeta));
        } catch (_) {}
      }
    }
  };

  // Fetch Admin PIN Configuration from Firestore
  const fetchAdminPin = async () => {
    try {
      const docRef = doc(db, "admin_settings", "pin_config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAdminPin(docSnap.data().pin || "5074");
      } else {
        setAdminPin("5074");
      }
    } catch (err) {
      console.warn("Erro ao carregar o PIN de administração (usando fallback 5074):", err);
      setAdminPin("5074"); // default fallback
    }
  };

  // Fetch info and PIN on mount
  useEffect(() => {
    fetchCustomApkInfo();
    fetchAdminPin();
    fetchAppSettings();
  }, []);

  // Sync admin link inputs when the secret panel is opened
  useEffect(() => {
    if (showAdminPanel) {
      setPcLinkInput(pcLink);
      setShareLinkInput(shareLink);
    }
  }, [showAdminPanel, pcLink, shareLink]);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Clear mock state immediately on login so we don't query mock classes
        setClasses([]);
        setSelectedClassId("");
        setTargetClassForImport("");

        // Refresh admin PIN securely now that user might have authenticated
        fetchAdminPin();
      } else {
        // Revert to demo classes if logged out
        setClasses([
          { id: "1", name: "9º Ano A", subject: "Matemática", createdAt: "2026-06-28", studentCount: 24 },
          { id: "2", name: "3º Ano EM", subject: "Português", createdAt: "2026-06-29", studentCount: 31 },
          { id: "3", name: "1º Ano B", subject: "História", createdAt: "2026-06-30", studentCount: 18 },
        ]);
        setSelectedClassId("1");
        setTargetClassForImport("1");
        setAdminPin("5074"); // default fallback for guests
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync classes real-time with Firestore when user is logged in
  useEffect(() => {
    if (!user) {
      return;
    }

    const q = query(collection(db, "classes"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedClasses: ClassRoom[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedClasses.push({
          id: docSnap.id,
          name: data.name,
          subject: data.subject,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split("T")[0] : data.createdAt || "",
          studentCount: data.studentCount || 0
        });
      });
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) {
        setSelectedClassId((prev) => loadedClasses.some(c => c.id === prev) ? prev : loadedClasses[0].id);
        setTargetClassForImport((prev) => loadedClasses.some(c => c.id === prev) ? prev : loadedClasses[0].id);
      } else {
        setSelectedClassId("");
        setTargetClassForImport("");
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "classes");
    });

    return () => unsubscribe();
  }, [user]);

  // Sync students real-time when class changes
  useEffect(() => {
    if (!user || !selectedClassId) {
      if (!user) {
        setStudentsByClass({
          "1": [
            { id: "s1", name: "Ana Beatriz Oliveira" },
            { id: "s2", name: "Carlos Eduardo Costa" },
            { id: "s3", name: "Diana Santos Rocha" },
            { id: "s4", name: "Felipe Augusto Souza" },
            { id: "s5", name: "Gabriela Mendes Silva" },
          ],
          "2": [
            { id: "s2-1", name: "Arthur Ribeiro" },
            { id: "s2-2", name: "Beatriz Nogueira" },
            { id: "s2-3", name: "Caio Ferreira" },
          ],
          "3": [
            { id: "s3-1", name: "Daniela Alencar" },
            { id: "s3-2", name: "Eduardo Fonseca" },
          ],
        });
      }
      return;
    }

    if (["1", "2", "3"].includes(selectedClassId)) {
      return;
    }

    // Verify if selectedClassId actually exists in our loaded classes state to prevent querying non-existent class subcollections
    const classExists = classes.some(c => c.id === selectedClassId);
    if (!classExists) {
      return;
    }

    const ref = collection(db, "classes", selectedClassId, "students");
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const loadedStudents: Student[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedStudents.push({
          id: docSnap.id,
          name: data.name,
        });
      });
      setStudentsByClass((prev) => ({
        ...prev,
        [selectedClassId]: loadedStudents,
      }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `classes/${selectedClassId}/students`);
    });

    return () => unsubscribe();
  }, [user, selectedClassId, classes]);

  // Load Official Key from Firestore if saved
  useEffect(() => {
    if (!user || !selectedClassId) return;

    if (["1", "2", "3"].includes(selectedClassId)) {
      return;
    }

    // Verify if selectedClassId actually exists in our loaded classes state
    const classExists = classes.some(c => c.id === selectedClassId);
    if (!classExists) return;

    const examRef = doc(db, "classes", selectedClassId, "exams", "default");
    getDoc(examRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.officialKey) {
          setOfficialKey(data.officialKey);
          setNumQuestions(data.numQuestions || 10);
        }
      }
    }).catch((err) => {
      console.warn("Could not fetch exam key:", err);
    });
  }, [user, selectedClassId, classes]);

  // Sync correction history real-time
  useEffect(() => {
    if (!user || !selectedClassId) {
      setHistoricResults([]);
      return;
    }

    if (["1", "2", "3"].includes(selectedClassId)) {
      setHistoricResults([]);
      return;
    }

    // Verify if selectedClassId actually exists in our loaded classes state
    const classExists = classes.some(c => c.id === selectedClassId);
    if (!classExists) {
      setHistoricResults([]);
      return;
    }

    const q = query(
      collection(db, "classes", selectedClassId, "exams", "default", "results"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: GradedResult[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        results.push({
          studentName: data.studentName,
          studentAnswers: data.studentAnswers || [],
          score: data.score || 0,
          correctCount: data.correctCount || 0,
          totalQuestions: data.totalQuestions || 10,
          aiFeedback: data.aiFeedback || "",
          mode: "firebase_cloud",
          message: data.createdAt?.toDate ? `Salvo em ${data.createdAt.toDate().toLocaleDateString()} ${data.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ""
        });
      });
      setHistoricResults(results);
    }, (err) => {
      console.warn("Historic results info:", err.message);
    });

    return () => unsubscribe();
  }, [user, selectedClassId, classes]);

  // Helper to save correction result to Firestore
  const saveGradedResultToFirestore = async (result: GradedResult) => {
    if (!user || !selectedClassId) return;

    const resultId = Math.random().toString(36).substring(2, 9);
    try {
      const resultRef = doc(db, "classes", selectedClassId, "exams", "default", "results", resultId);
      await setDoc(resultRef, {
        studentName: result.studentName,
        studentAnswers: result.studentAnswers,
        score: result.score,
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions,
        aiFeedback: result.aiFeedback,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `classes/${selectedClassId}/exams/default/results/${resultId}`);
    }
  };

  const handleGenerateAdminMockData = async () => {
    if (!user) {
      alert("Por favor, entre com sua conta Google primeiro para gerar dados de simulação na nuvem!");
      return;
    }
    try {
      const mockClassId = "class_admin_" + Math.random().toString(36).substring(2, 7);
      
      // 1. Create Class
      const classRef = doc(db, "classes", mockClassId);
      await setDoc(classRef, {
        name: "Sala de Testes Admin",
        subject: "Ciências da Natureza",
        studentCount: 5,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Create Students
      const students = ["Mariana Silva", "Lucas Souza", "Pedro Alves", "Julia Costa", "Enzo Ribeiro"];
      const batch = writeBatch(db);
      for (const name of students) {
        const studentId = "student_" + Math.random().toString(36).substring(2, 7);
        const studentRef = doc(db, "classes", mockClassId, "students", studentId);
        batch.set(studentRef, {
          name,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      // 3. Create Exam Default Key
      const examRef = doc(db, "classes", mockClassId, "exams", "default");
      const mockKey: AnswerKey[] = [
        { questionNumber: 1, correctAnswer: "A" },
        { questionNumber: 2, correctAnswer: "B" },
        { questionNumber: 3, correctAnswer: "C" },
        { questionNumber: 4, correctAnswer: "D" },
        { questionNumber: 5, correctAnswer: "E" },
        { questionNumber: 6, correctAnswer: "A" },
        { questionNumber: 7, correctAnswer: "B" },
        { questionNumber: 8, correctAnswer: "C" },
        { questionNumber: 9, correctAnswer: "D" },
        { questionNumber: 10, correctAnswer: "E" },
      ];
      batch.set(examRef, {
        name: "Prova Semestral de Ciências",
        numQuestions: 10,
        officialKey: mockKey,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });

      // 4. Create Graded Results
      const resultsData = [
        { name: "Mariana Silva", score: 10.0, correct: 10, answers: ["A", "B", "C", "D", "E", "A", "B", "C", "D", "E"], feedback: "Desempenho espetacular! Mariana demonstrou domínio completo dos tópicos avaliados nesta prova." },
        { name: "Lucas Souza", score: 7.0, correct: 7, answers: ["A", "B", "A", "D", "C", "A", "B", "A", "D", "E"], feedback: "Bom desempenho geral, mas Lucas apresentou falhas em questões específicas de ecologia e cadeias alimentares." },
        { name: "Enzo Ribeiro", score: 4.0, correct: 4, answers: ["C", "C", "C", "A", "E", "A", "D", "C", "A", "E"], feedback: "Enzo precisa de reforço imediato na base de biologia celular para compreender as correlações corretas." },
      ];

      for (const r of resultsData) {
        const resultId = "result_" + Math.random().toString(36).substring(2, 7);
        const resultRef = doc(db, "classes", mockClassId, "exams", "default", "results", resultId);
        batch.set(resultRef, {
          studentName: r.name,
          studentAnswers: r.answers,
          score: r.score,
          correctCount: r.correct,
          totalQuestions: 10,
          aiFeedback: r.feedback,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      alert("Sucesso! Uma turma de testes completa foi injetada no Firestore. Aproveite para verificar!");
      setSelectedClassId(mockClassId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "admin_mock_data");
    }
  };

  const handleClearAdminMockData = async () => {
    if (!user) {
      alert("Por favor, entre com sua conta Google primeiro!");
      return;
    }
    if (!confirm("Aviso: Isso irá excluir a turma selecionada e todos os seus sub-documentos (Alunos, Provas, Resultados) diretamente do banco Firestore. Continuar?")) {
      return;
    }
    if (!selectedClassId) {
      alert("Nenhuma turma selecionada para remoção!");
      return;
    }
    try {
      const batch = writeBatch(db);
      const classRef = doc(db, "classes", selectedClassId);
      batch.delete(classRef);

      const examRef = doc(db, "classes", selectedClassId, "exams", "default");
      batch.delete(examRef);

      await batch.commit();
      alert("Turma excluída com sucesso do Firestore!");
      setSelectedClassId("");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${selectedClassId}`);
    }
  };

  const handleVerifyPin = () => {
    if (pinInput.trim() === adminPin) {
      setShowPinPrompt(false);
      setShowAdminPanel(true);
      setPinError("");
      setPinInput("");
    } else {
      setPinError("PIN incorreto! Tente novamente.");
    }
  };

  const handleChangePin = async () => {
    if (!user) {
      alert("Por favor, conecte-se com sua conta Google primeiro para salvar as configurações de PIN na nuvem!");
      return;
    }
    if (newPinInput.length < 4) {
      alert("O PIN deve conter pelo menos 4 caracteres!");
      return;
    }
    setChangingPin(true);
    try {
      const docRef = doc(db, "admin_settings", "pin_config");
      await setDoc(docRef, {
        pin: newPinInput
      });
      setAdminPin(newPinInput);
      setNewPinInput("");
      alert(`PIN de acesso alterado com sucesso para: ${newPinInput}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "admin_settings/pin_config");
    } finally {
      setChangingPin(false);
    }
  };

  const handleLocalApkUploadFallback = (file: File, base64Data: string) => {
    try {
      const mockMeta = {
        customApkExists: true,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        isLocalFallback: true
      };
      
      // Store metadata in localStorage
      localStorage.setItem("local_custom_apk_meta", JSON.stringify(mockMeta));
      
      // Store file payload in localStorage if small, else just keep in session
      if (base64Data.length < 3.5 * 1024 * 1024) {
        try {
          localStorage.setItem("local_custom_apk_file", base64Data);
        } catch (e) {
          console.warn("Arquivo APK grande para LocalStorage, mantido apenas na sessão ativa.");
        }
      }
      
      // Save globally in window object for session-based downloads
      (window as any).__local_apk_file_data = base64Data;
      (window as any).__local_apk_file_name = file.name;

      setCustomApkInfo(mockMeta);
      setApkSuccess("Upload Concluído! Detectamos um ambiente estático (ex: Vercel) e salvamos seu APK com segurança na memória local do seu navegador!");
    } catch (err: any) {
      setApkError("Erro no armazenamento temporário do APK: " + err.message);
    }
  };

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".apk")) {
      setApkError("Por favor, selecione apenas arquivos do tipo .apk.");
      return;
    }

    setApkUploading(true);
    setApkError("");
    setApkSuccess("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = event.target?.result as string;
        
        let res;
        try {
          res = await fetch("/api/upload-apk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              filename: file.name,
              base64Data
            })
          });
        } catch (fetchErr: any) {
          console.warn("Servidor inacessível, salvando localmente no navegador:", fetchErr);
          handleLocalApkUploadFallback(file, base64Data);
          return;
        }

        const contentType = res.headers.get("Content-Type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
          console.warn("Resposta não é JSON (ambiente estático Vercel ou similar). Salvando localmente.");
          handleLocalApkUploadFallback(file, base64Data);
          return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
          setApkSuccess("Arquivo APK salvo e persistido com sucesso no servidor!");
          fetchCustomApkInfo();
        } else {
          setApkError(data.error || "Erro ao salvar arquivo no servidor.");
        }
      } catch (err: any) {
        setApkError("Erro ao enviar arquivo para o servidor: " + err.message);
      } finally {
        setApkUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteCustomApk = async () => {
    if (!confirm("Tem certeza que deseja remover o APK personalizado e reverter para a simulação padrão?")) {
      return;
    }

    try {
      const res = await fetch("/api/delete-custom-apk", {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("APK personalizado removido. Revertido para simulador!");
        fetchCustomApkInfo();
      } else {
        alert(data.error || "Erro ao deletar APK.");
      }
    } catch (err: any) {
      alert("Erro ao remover APK: " + err.message);
    }
  };

  const handleSaveOfficialKey = async () => {
    if (user) {
      if (!selectedClassId) {
        alert("Por favor, selecione ou crie uma turma antes de salvar o gabarito oficial.");
        return;
      }
      try {
        const examRef = doc(db, "classes", selectedClassId, "exams", "default");
        await setDoc(examRef, {
          name: "Gabarito Oficial",
          numQuestions: numQuestions,
          officialKey: officialKey,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
        alert("Gabarito Oficial salvo com sucesso na nuvem e ativado no corretor!");
        setActiveTab("corrigir");
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `classes/${selectedClassId}/exams/default`);
      }
    } else {
      alert("Gabarito Oficial salvo com sucesso e ativado no corretor de provas!");
      setActiveTab("corrigir");
    }
  };

  // Auto update official answer key length if numQuestions changes
  useEffect(() => {
    setOfficialKey(prev => {
      const next: AnswerKey[] = [];
      for (let i = 1; i <= numQuestions; i++) {
        const existing = prev.find(k => k.questionNumber === i);
        next.push({
          questionNumber: i,
          correctAnswer: existing?.correctAnswer || (["A", "B", "C", "D", "E"][Math.floor(Math.random() * 5)] as any)
        });
      }
      return next;
    });

    // Also adjust student mockup key
    setStudentKey(prev => {
      const next: Record<number, "A" | "B" | "C" | "D" | "E" | ""> = {};
      for (let i = 1; i <= numQuestions; i++) {
        if (prev[i] !== undefined) {
          next[i] = prev[i];
        } else {
          next[i] = ["A", "B", "C", "D", "E"][Math.floor(Math.random() * 5)] as any;
        }
      }
      return next;
    });
  }, [numQuestions]);

  // Handlers
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassSubject.trim()) return;

    const newClassId = Math.random().toString(36).substring(2, 9);

    if (user) {
      try {
        const classRef = doc(db, "classes", newClassId);
        await setDoc(classRef, {
          name: newClassName.trim(),
          subject: newClassSubject.trim(),
          studentCount: 0,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
        setSelectedClassId(newClassId);
        setNewClassName("");
        setNewClassSubject("");
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `classes/${newClassId}`);
      }
    } else {
      const newClass: ClassRoom = {
        id: newClassId,
        name: newClassName.trim(),
        subject: newClassSubject.trim(),
        createdAt: new Date().toISOString().split("T")[0],
        studentCount: 0
      };

      setClasses(prev => [newClass, ...prev]);
      setStudentsByClass(prev => ({ ...prev, [newClass.id]: [] }));
      setSelectedClassId(newClass.id);
      setNewClassName("");
      setNewClassSubject("");
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (confirm("Deseja realmente excluir esta turma? Todos os alunos serão removidos do sistema.")) {
      if (user) {
        try {
          const classRef = doc(db, "classes", id);
          await deleteDoc(classRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `classes/${id}`);
        }
      } else {
        setClasses(prev => prev.filter(c => c.id !== id));
        const updatedStudents = { ...studentsByClass };
        delete updatedStudents[id];
        setStudentsByClass(updatedStudents);
      }
    }
  };

  const handleFillDemoStudents = () => {
    setRawStudentsText(
      "1 - Mariana de Souza Barbosa\n2. PEDRO HENRIQUE SILVA ALVES\nLucas Goulart (transferido)\n4) Ana Clara Oliveira de Lima - OK\n#5 Gabriel Medeiros Costa\nJúlia de Freitas Santos\nRodrigo Fernandes Rocha (Falta)"
    );
  };

  const handleProcessStudentsAI = async () => {
    setIsProcessingStudents(true);
    setImportMessage(null);
    try {
      const response = await fetch("/api/parse-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawStudentsText }),
      });
      const data = await response.json();
      if (data.students) {
        setParsedStudents(data.students);
        if (data.mode === "local_fallback") {
          setImportMessage("Demonstração: Lista limpa localmente. Adicione a sua GEMINI_API_KEY para processamentos inteligentes complexos.");
        } else {
          setImportMessage(data.message || "Alunos processados com sucesso usando IA!");
        }
      }
    } catch (e) {
      console.error(e);
      setImportMessage("Erro na requisição. Processando localmente como fallback.");
      // Client-side regex fallback if fetch fails
      const lines = rawStudentsText.split("\n");
      const clientSideParsed = lines
        .map(l => l.replace(/^[\d\s\-\.\#\)\(ºª]+/, "").trim())
        .map(l => l.replace(/\s*[\(\-\[].*$/, "").trim())
        .filter(l => l.length > 2)
        .map(l => l.toLowerCase().split(" ").map(w => ["de", "da", "do", "das", "dos", "e"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
      setParsedStudents(clientSideParsed);
    } finally {
      setIsProcessingStudents(false);
    }
  };

  const handleSaveImportedStudents = async () => {
    if (parsedStudents.length === 0) return;

    if (user) {
      try {
        const batch = writeBatch(db);
        const targetClassRef = doc(db, "classes", targetClassForImport);

        parsedStudents.forEach((name) => {
          const studentId = Math.random().toString(36).substring(2, 9);
          const studentRef = doc(db, "classes", targetClassForImport, "students", studentId);
          batch.set(studentRef, {
            name,
            ownerId: user.uid,
            createdAt: serverTimestamp()
          });
        });

        const currentCount = (studentsByClass[targetClassForImport] || []).length;
        batch.update(targetClassRef, {
          studentCount: currentCount + parsedStudents.length
        });

        await batch.commit();

        setParsedStudents([]);
        alert(`Sucesso! ${parsedStudents.length} alunos salvos no banco de dados em nuvem.`);
        setActiveTab("salas");
        setSelectedClassId(targetClassForImport);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `classes/${targetClassForImport}/students`);
      }
    } else {
      const currentStudents = studentsByClass[targetClassForImport] || [];
      const newStudentsList = [
        ...currentStudents,
        ...parsedStudents.map(name => ({
          id: Math.random().toString(36).substring(2, 9),
          name
        }))
      ];

      setStudentsByClass(prev => ({
        ...prev,
        [targetClassForImport]: newStudentsList
      }));

      // Update class student count
      setClasses(prev => prev.map(c => {
        if (c.id === targetClassForImport) {
          return { ...c, studentCount: newStudentsList.length };
        }
        return c;
      }));

      setParsedStudents([]);
      alert(`Sucesso! ${parsedStudents.length} alunos foram adicionados à turma selecionada.`);
      setActiveTab("salas");
      setSelectedClassId(targetClassForImport);
    }
  };

  const handleSetOfficialBubble = (qNum: number, answer: "A" | "B" | "C" | "D" | "E") => {
    setOfficialKey(prev => prev.map(k => {
      if (k.questionNumber === qNum) {
        return { ...k, correctAnswer: k.correctAnswer === answer ? "" : answer };
      }
      return k;
    }));
  };

  const handleSetStudentBubble = (qNum: number, answer: "A" | "B" | "C" | "D" | "E") => {
    setStudentKey(prev => ({
      ...prev,
      [qNum]: prev[qNum] === answer ? "" : answer
    }));
  };

  const handleRandomOfficialKey = () => {
    const letters: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];
    setOfficialKey(prev => prev.map(k => ({
      ...k,
      correctAnswer: letters[Math.floor(Math.random() * 5)]
    })));
  };

  const handleGradeMockExam = () => {
    setIsGrading(true);
    setGradedResult(null);

    // Simulate scanning delay
    setTimeout(() => {
      const correctAnswersList = officialKey.map(k => k.correctAnswer || "A");
      const studentAnswersList = officialKey.map(k => studentKey[k.questionNumber] || "");

      const correctCount = studentAnswersList.reduce((acc, ans, idx) => {
        return acc + (ans === correctAnswersList[idx] ? 1 : 0);
      }, 0);

      const calculatedScore = (correctCount / numQuestions) * 10;

      // Provide dynamic contextual pedagogical feedback
      let aiFeedback = "";
      const errorCount = numQuestions - correctCount;
      if (calculatedScore >= 8.5) {
        aiFeedback = `Parabéns ao aluno ${graderStudentName}! Demonstras excelente domínio sobre os temas abordados. O excelente desempenho geral comprova alto engajamento. Recomenda-se desafios de nível avançado ou monitoria.`;
      } else if (calculatedScore >= 6.0) {
        aiFeedback = `Bom desempenho de ${graderStudentName}. Identificamos que o aluno acertou a maioria das questões, mas apresentou erros pontuais (${errorCount} questões). Recomenda-se revisar as questões correspondentes para solidificar o aprendizado e evitar dúvidas residuais nas próximas etapas.`;
      } else {
        aiFeedback = `Atenção necessária para ${graderStudentName}. A nota final (${calculatedScore.toFixed(1)}) indica dificuldades em conceitos-chave abordados nas questões erradas. Recomendamos uma sessão de reforço focada e exercícios complementares dirigidos para sanar os pontos de confusão identificados.`;
      }

      const result: GradedResult = {
        studentName: graderStudentName,
        studentAnswers: studentAnswersList,
        score: Number(calculatedScore.toFixed(1)),
        correctCount,
        totalQuestions: numQuestions,
        aiFeedback,
        mode: "local_simulation",
        message: "Demonstração: Correção processada instantaneamente."
      };

      setGradedResult(result);
      if (user) {
        saveGradedResultToFirestore(result);
      }
      setIsGrading(false);
    }, 1500);
  };

  // Image upload real scanner logic
  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress("Carregando e processando imagem...");
    setIsGrading(true);
    setGradedResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const cleanAnswerKeyArray = officialKey.map(k => k.correctAnswer || "A");

      try {
        const response = await fetch("/api/grade-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64String,
            answerKey: cleanAnswerKeyArray
          })
        });

        if (!response.ok) {
          throw new Error("Resposta com erro no servidor.");
        }

        const data = await response.json();
        const result: GradedResult = {
          studentName: "Estudante (Digitalizado por Foto)",
          studentAnswers: data.studentAnswers || cleanAnswerKeyArray.map(() => ""),
          score: data.score,
          correctCount: data.correctCount,
          totalQuestions: data.totalQuestions || numQuestions,
          aiFeedback: data.aiFeedback,
          mode: data.mode,
          message: data.message
        };

        setGradedResult(result);
        if (user) {
          saveGradedResultToFirestore(result);
        }
      } catch (err: any) {
        console.error(err);
        // Fallback simulated result on upload error
        alert("Configuração de IA ausente ou limite atingido. Simulação ativada!");
        const mockAnswers = cleanAnswerKeyArray.map(correct => Math.random() > 0.25 ? correct : "A");
        const correctCount = mockAnswers.reduce((acc, cur, idx) => acc + (cur === cleanAnswerKeyArray[idx] ? 1 : 0), 0);
        
        const result: GradedResult = {
          studentName: "Estudante (Simulado via Upload)",
          studentAnswers: mockAnswers,
          score: Number(((correctCount / numQuestions) * 10).toFixed(1)),
          correctCount,
          totalQuestions: numQuestions,
          aiFeedback: "Gabarito corrigido através do modo de segurança de simulação. Para habilitar reconhecimento por foto real via Visão Computacional, adicione uma GEMINI_API_KEY válida nos segredos do seu painel do AI Studio.",
          mode: "fallback_simulation"
        };

        setGradedResult(result);
        if (user) {
          saveGradedResultToFirestore(result);
        }
      } finally {
        setUploadProgress(null);
        setIsGrading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const triggerDownloadApkHelp = () => {
    setShowApkInstructions(true);
    
    // Check if we are in local fallback mode
    if (customApkInfo?.isLocalFallback) {
      const base64Data = (window as any).__local_apk_file_data || localStorage.getItem("local_custom_apk_file");
      const filename = (window as any).__local_apk_file_name || customApkInfo?.originalName || "gabarito_ia.apk";

      if (base64Data) {
        const apkLink = document.createElement("a");
        apkLink.href = base64Data;
        apkLink.download = filename;
        document.body.appendChild(apkLink);
        apkLink.click();
        document.body.removeChild(apkLink);
        return;
      }
    }

    // Standard download from backend
    const apkLink = document.createElement("a");
    apkLink.href = "/api/download-apk";
    apkLink.download = customApkInfo?.originalName || "gabarito_ia.apk";
    document.body.appendChild(apkLink);
    apkLink.click();
    document.body.removeChild(apkLink);
  };

  const handleCopyDownloadLink = () => {
    const directUrl = customApkInfo?.isLocalFallback 
      ? window.location.origin + "#local-apk" 
      : window.location.origin + "/api/download-apk";
      
    navigator.clipboard.writeText(directUrl)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      })
      .catch((err) => {
        console.error("Erro ao copiar link:", err);
      });
  };

  const copyShareLinkToClipboard = () => {
    const pageUrl = shareLink ? shareLink : window.location.origin;
    navigator.clipboard.writeText(pageUrl)
      .then(() => {
        setCopiedShareLink(true);
        setTimeout(() => setCopiedShareLink(false), 3000);
      })
      .catch((err) => {
        console.error("Erro ao copiar link de compartilhamento:", err);
      });
  };

  const handleSharePage = () => {
    const pageUrl = shareLink ? shareLink : window.location.origin;
    const shareData = {
      title: "Gabarito IA - Correção Inteligente de Provas",
      text: "Baixe o aplicativo Gabarito IA para Android e corrija suas provas e gabaritos em segundos com inteligência artificial!",
      url: pageUrl
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(() => console.log("Compartilhado com sucesso!"))
        .catch((err) => {
          console.error("Erro ao compartilhar:", err);
          copyShareLinkToClipboard();
        });
    } else {
      copyShareLinkToClipboard();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f2ea]">
      {/* HEADER SECTION - Styled exactly to match the brown image */}
      <header className="bg-gabarito-brown text-white py-12 px-6 shadow-sm border-b border-[#4d3327] text-center relative">
        {/* Auth Floating Banner */}
        <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
          {authLoading ? (
            <div className="text-xs text-amber-50/70 animate-pulse font-medium">Carregando...</div>
          ) : user ? (
            <div className="flex items-center gap-2 bg-[#4a3123] border border-[#6b4c39] px-3 py-1.5 rounded-xl shadow-xs">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-amber-100 text-stone-800 flex items-center justify-center text-[10px] font-bold">
                  {user.displayName?.charAt(0) || "P"}
                </div>
              )}
              <span className="text-xs text-amber-50 font-medium max-w-[120px] truncate">
                Olá, {user.displayName?.split(" ")[0]}
              </span>
              <button 
                onClick={() => signOut(auth)}
                className="text-[10px] bg-amber-900/40 hover:bg-[#ff4444] text-white font-bold px-2 py-0.5 rounded-md transition cursor-pointer"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="bg-white hover:bg-amber-50 text-gabarito-brown font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer border border-[#ddd]"
            >
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>
              Entrar com Google (Salvar na Nuvem)
            </button>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-3"
            id="gabarito-header-title"
          >
            Gabarito IA
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-lg text-amber-50/95 font-medium tracking-wide max-w-2xl mx-auto"
            id="gabarito-header-subtitle"
          >
            Correção inteligente de provas com Inteligência Artificial
          </motion.p>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        
        {/* CARD 1: BAIXE O APLICATIVO */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xs p-6 md:p-8 text-center"
          id="gabarito-download-card"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-2">
            Baixe o aplicativo
          </h2>
          <p className="text-stone-600 text-sm md:text-base mb-6 max-w-2xl mx-auto">
            Use o Gabarito IA para criar salas, cadastrar alunos, gerar gabaritos e corrigir provas rapidamente.
          </p>
          
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-4 w-full max-w-2xl px-4">
              {/* BUTTON 1: BAIXAR APK */}
              <a
                href={customApkInfo?.isLocalFallback ? "#" : "/api/download-apk"}
                download={customApkInfo?.originalName || "gabarito_ia.apk"}
                target={customApkInfo?.isLocalFallback ? "_self" : "_blank"}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (customApkInfo?.isLocalFallback) {
                    e.preventDefault();
                  }
                  triggerDownloadApkHelp();
                }}
                className="flex-1 bg-gabarito-brown hover:bg-[#43291c] text-white font-bold px-6 py-4 rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2.5 text-base md:text-lg cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] no-underline"
                id="gabarito-btn-download"
              >
                {/* Custom retro keypad phone icon resembling the icon in picture */}
                <div className="w-6 h-6 bg-sky-100 rounded-sm flex items-center justify-center p-0.5 border border-sky-300">
                  <div className="w-full h-full bg-blue-600 rounded-xs flex flex-col justify-between p-0.5 relative overflow-hidden">
                    <div className="w-full h-2 bg-sky-200 rounded-2xs"></div>
                    <div className="grid grid-cols-3 gap-0.5 w-full mt-0.5">
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                      <div className="w-full h-0.5 bg-yellow-300 rounded-3xs"></div>
                    </div>
                    {/* tiny arrow down */}
                    <div className="absolute right-0.5 bottom-0.5 text-[6px] text-white font-extrabold">↓</div>
                  </div>
                </div>
                Baixar APK (Android)
              </a>

              {/* BUTTON 2: ENTRAR COM O PC (HIGHLIGHTED / DESTACADO) */}
              <a
                href={pcLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-4 rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2.5 text-base md:text-lg cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] no-underline border-b-4 border-blue-800"
                id="gabarito-btn-entrar-pc"
              >
                <Monitor className="w-6 h-6 text-sky-100" />
                <span>Entrar com o PC</span>
              </a>
            </div>

            {/* Utility Actions row */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCopyDownloadLink}
                className="text-stone-600 hover:text-stone-900 text-xs font-mono font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100/80 hover:bg-stone-100 border border-stone-200 transition cursor-pointer"
                title="Copiar link direto para baixar fora do iframe"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                    <span className="text-emerald-700 font-sans font-bold">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="font-sans font-bold">Copiar Link Direto</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSharePage}
                className="text-stone-600 hover:text-stone-900 text-xs font-mono font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100/80 hover:bg-stone-100 border border-stone-200 transition cursor-pointer"
                title="Compartilhar esta página com outros professores"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                    <span className="text-emerald-700 font-sans font-bold">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-amber-600" />
                    <span className="font-sans font-bold">Compartilhar Página</span>
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-stone-400">Versão 1.4.2 para Android (APK Seguro)</p>
          </div>

          <AnimatePresence>
            {showApkInstructions && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-5 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-left max-w-xl mx-auto shadow-xs"
              >
                <div className="flex gap-3 items-start">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm md:text-base">
                        Download iniciado com sucesso! 🚀
                      </h4>
                      <p className="text-stone-600 text-xs md:text-sm mt-1">
                        O arquivo do aplicativo <span className="font-mono bg-stone-200/60 px-1 rounded text-stone-800 text-xs font-semibold">{customApkInfo?.customApkExists ? customApkInfo.originalName : "gabarito_ia.apk"}</span> foi enviado ao seu dispositivo.
                      </p>
                    </div>

                    <div className="border-t border-amber-200/50 pt-3 space-y-2">
                      <h5 className="font-bold text-stone-800 text-xs md:text-sm uppercase tracking-wider font-mono">
                        Como instalar no seu celular Android:
                      </h5>
                      <ol className="list-decimal list-inside text-xs text-stone-600 space-y-1.5 leading-relaxed">
                        <li>
                          Abra o arquivo <b className="text-stone-800">.apk</b> na pasta de <b className="text-stone-800">Downloads</b> do seu aparelho.
                        </li>
                        <li>
                          Se o sistema solicitar permissão, clique em <b className="text-stone-800">Configurações</b> e ative a permissão <b className="text-stone-800">"Permitir desta fonte"</b> (ou Fontes Desconhecidas).
                        </li>
                        <li>
                          Clique em <b className="text-stone-800">Instalar</b> e, após terminar, clique em <b className="text-stone-800">Abrir</b>.
                        </li>
                        <li>
                          Pronto! Entre com sua conta do Google e comece a corrigir suas provas em tempo real!
                        </li>
                      </ol>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      {customApkInfo?.customApkExists && (
                        <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ APK PERSONALIZADO ATIVO
                        </span>
                      )}
                      <button 
                        onClick={() => setShowApkInstructions(false)}
                        className="text-xs font-bold text-gabarito-brown hover:underline cursor-pointer ml-auto"
                      >
                        Entendi, fechar aviso
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* NEW CARD: MARKTING / PROMOTIONAL SHOWCASE WITH HAPPY TEACHERS */}
        <section 
          className="bg-[#faf7f2] border border-amber-200/55 rounded-2xl shadow-xs p-6 md:p-8 space-y-8"
          id="gabarito-marketing-card"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="bg-amber-100 text-gabarito-brown text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              Professores Satisfeitos
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">
              A Escolha Inteligente dos Professores de Sucesso
            </h2>
            <p className="text-stone-600 text-sm md:text-base">
              Veja como o Gabarito IA está transformando a rotina escolar, economizando horas preciosas de correção de provas e trazendo mais leveza para a vida docente.
            </p>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="flex justify-center">
            
            {/* Card 1: Female Teacher (Public Servant) */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row h-full max-w-3xl w-full">
              <div className="relative h-56 md:h-auto md:w-80 bg-stone-100 overflow-hidden shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&q=80&w=800" 
                  alt="Professora Sandra Sousa sorrindo em sala de aula" 
                  className="w-full h-full object-cover object-center hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-3 left-3 bg-gabarito-brown text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm font-mono">
                  ★ SERVIDORA PÚBLICA ESTADUAL
                </div>
              </div>
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex text-amber-500 text-sm gap-0.5">
                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                    <span className="text-stone-700 font-bold text-xs ml-1">(5.0)</span>
                  </div>
                  <h3 className="font-bold text-stone-900 text-xl">
                    "O Gabarito IA foi a salvação para minhas classes cheias!"
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    "Como funcionária pública de escola estadual, tenho turmas com mais de 40 alunos. O Gabarito IA foi a minha maior salvação! Ele corrige dezenas de provas instantaneamente usando a câmera do celular. O aplicativo é rápido, preciso e me devolveu os finais de semana de descanso!"
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-stone-800 text-sm">Profª. Sandra Sousa</h4>
                    <p className="text-stone-500 text-[11px]">Professora de Língua Portuguesa • Rede Estadual</p>
                  </div>
                  <span className="text-emerald-600 bg-emerald-50 text-[10px] font-extrabold px-2.5 py-1 rounded border border-emerald-200 uppercase tracking-wider font-mono">
                    Compra Verificada
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Core Call-to-Action to buy/join */}
          <div className="bg-gradient-to-br from-[#4d3327] to-gabarito-brown text-white rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 border border-[#3e271c]">
            <div className="space-y-2 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Award className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-amber-300 font-bold text-xs uppercase tracking-wider font-mono">PROMOÇÃO ESPECIAL DE LANÇAMENTO</span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold">
                Simplifique Suas Correções Hoje Mesmo!
              </h3>
              <p className="text-amber-100/90 text-xs md:text-sm max-w-xl">
                Pare de desperdiçar finais de semana inteiros com caneta vermelha. Tenha acesso a um aplicativo moderno, seguro e desenvolvido especialmente para a realidade dos professores brasileiros.
              </p>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <a 
                href="#gabarito-btn-download"
                className="w-full sm:w-auto text-center bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold px-6 py-3 rounded-xl transition duration-200 shadow-sm text-sm"
              >
                Garantir Meu Acesso
              </a>
              <a 
                href={pcLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center bg-transparent hover:bg-white/10 text-white border border-white/30 font-bold px-5 py-3 rounded-xl transition duration-200 text-sm"
              >
                Conhecer Versão Web
              </a>
            </div>
          </div>
        </section>

        {/* CARD 2: O QUE O APP FAZ? WITH INTERACTIVE TABS */}
        <section 
          className="bg-white rounded-2xl shadow-xs p-6 md:p-8"
          id="gabarito-features-card"
        >
          <h2 className="text-xl md:text-2xl font-bold text-stone-900 mb-6 text-center">
            O que o app faz?
          </h2>

          {/* Feature Grid / Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            
            {/* Tab 1 */}
            <button
              onClick={() => setActiveTab("salas")}
              className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "salas"
                  ? "border-[#553625] bg-[#faf7f2] ring-2 ring-[#553625]/20 shadow-xs"
                  : "border-stone-200 bg-[#fdfbf7] hover:bg-stone-50"
              }`}
              id="gabarito-tab-salas"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-300">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
                <span className="font-medium text-stone-800 text-sm sm:text-base">
                  Cria salas e turmas
                </span>
              </div>
            </button>

            {/* Tab 2 */}
            <button
              onClick={() => setActiveTab("importar")}
              className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "importar"
                  ? "border-[#553625] bg-[#faf7f2] ring-2 ring-[#553625]/20 shadow-xs"
                  : "border-stone-200 bg-[#fdfbf7] hover:bg-stone-50"
              }`}
              id="gabarito-tab-importar"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-300">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
                <span className="font-medium text-stone-800 text-sm sm:text-base">
                  Importa alunos com IA
                </span>
              </div>
            </button>

            {/* Tab 3 */}
            <button
              onClick={() => setActiveTab("gabarito")}
              className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "gabarito"
                  ? "border-[#553625] bg-[#faf7f2] ring-2 ring-[#553625]/20 shadow-xs"
                  : "border-stone-200 bg-[#fdfbf7] hover:bg-stone-50"
              }`}
              id="gabarito-tab-gabarito"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-300">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
                <span className="font-medium text-stone-800 text-sm sm:text-base">
                  Cria gabaritos oficiais
                </span>
              </div>
            </button>

            {/* Tab 4 */}
            <button
              onClick={() => setActiveTab("corrigir")}
              className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTab === "corrigir"
                  ? "border-[#553625] bg-[#faf7f2] ring-2 ring-[#553625]/20 shadow-xs"
                  : "border-stone-200 bg-[#fdfbf7] hover:bg-stone-50"
              }`}
              id="gabarito-tab-corrigir"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-300">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
                <span className="font-medium text-stone-800 text-sm sm:text-base">
                  Corrige provas por foto
                </span>
              </div>
            </button>

          </div>

          {/* ACTIVE TAB DEMO PANEL */}
          <div className="border border-stone-200 rounded-2xl p-6 bg-[#faf9f5]">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: SALAS E TURMAS */}
              {activeTab === "salas" && (
                <motion.div
                  key="salas-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <School className="w-5 h-5 text-gabarito-brown" />
                        Gerenciador de Salas e Turmas
                      </h3>
                      <p className="text-stone-500 text-xs mt-0.5">
                        Cadastre e visualize suas turmas e disciplinas ativas.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add Class Form */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-4">
                      <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-emerald-600" />
                        Nova Turma
                      </h4>
                      <form onSubmit={handleCreateClass} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-stone-500 mb-1">Nome da Turma</label>
                          <input 
                            type="text" 
                            placeholder="Ex: 9º Ano A, 2º Ano EM"
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.target.value)}
                            className="w-full text-xs p-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-gabarito-brown bg-stone-50"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-500 mb-1">Matéria / Disciplina</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Matemática, Física, Biologia"
                            value={newClassSubject}
                            onChange={(e) => setNewClassSubject(e.target.value)}
                            className="w-full text-xs p-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-gabarito-brown bg-stone-50"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-gabarito-brown hover:bg-[#43291c] text-white text-xs font-bold py-2 px-4 rounded-lg transition"
                        >
                          Adicionar Turma
                        </button>
                      </form>
                    </div>

                    {/* Classes List */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-bold text-stone-800 text-sm">Turmas Ativas ({classes.length})</h4>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {classes.map((cls) => (
                          <div 
                            key={cls.id}
                            className={`p-3 bg-white rounded-xl border transition-all flex items-center justify-between ${
                              selectedClassId === cls.id 
                                ? "border-gabarito-brown ring-1 ring-[#553625]/10 bg-amber-50/10" 
                                : "border-stone-200"
                            }`}
                          >
                            <div className="cursor-pointer flex-1" onClick={() => setSelectedClassId(cls.id)}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-950 text-sm">{cls.name}</span>
                                <span className="text-[10px] bg-amber-100 text-stone-800 px-2 py-0.5 rounded-full font-semibold">
                                  {cls.subject}
                                </span>
                              </div>
                              <div className="flex gap-4 mt-1 text-[11px] text-stone-500">
                                <span>Criada em: {cls.createdAt}</span>
                                <span className="font-semibold text-stone-700">{studentsByClass[cls.id]?.length || 0} Alunos</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteClass(cls.id)}
                              className="text-stone-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition"
                              title="Excluir turma"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Student list preview of selected class */}
                  <div className="bg-white p-4 rounded-xl border border-stone-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#553625]" />
                        Lista de Alunos: {classes.find(c => c.id === selectedClassId)?.name || "Nenhuma turma selecionada"}
                      </h4>
                      <button
                        onClick={() => {
                          setTargetClassForImport(selectedClassId);
                          setActiveTab("importar");
                        }}
                        className="text-xs text-[#553625] font-bold hover:underline flex items-center gap-1"
                      >
                        Importar alunos <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    {(!studentsByClass[selectedClassId] || studentsByClass[selectedClassId].length === 0) ? (
                      <div className="text-center py-6 text-stone-400 text-xs">
                        Nenhum aluno cadastrado nesta turma. Use a aba "Importa alunos com IA" para cadastrar sua lista em segundos!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {studentsByClass[selectedClassId].map((student, index) => (
                          <div key={student.id} className="text-xs bg-stone-50 p-2 rounded-lg border border-stone-100 flex items-center gap-2 text-stone-700">
                            <span className="font-bold text-stone-400 w-4 text-right">{index + 1}.</span>
                            <span className="truncate">{student.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: IMPORTAR ALUNOS COM IA */}
              {activeTab === "importar" && (
                <motion.div
                  key="importar-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      Importação Inteligente de Alunos
                    </h3>
                    <p className="text-stone-500 text-xs mt-0.5">
                      Cole qualquer lista confusa ou copiada do WhatsApp, Word ou Excel. A IA organizará os nomes automaticamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Raw Text Input */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-stone-700">Lista Bruta (WhatsApp, Word, etc.)</label>
                        <button
                          type="button"
                          onClick={handleFillDemoStudents}
                          className="text-xs text-gabarito-brown hover:underline font-semibold flex items-center gap-1"
                        >
                          Usar exemplo confuso
                        </button>
                      </div>
                      
                      <textarea
                        rows={8}
                        value={rawStudentsText}
                        onChange={(e) => setRawStudentsText(e.target.value)}
                        placeholder="Cole aqui a lista..."
                        className="w-full text-xs p-3 border border-stone-300 rounded-xl focus:outline-hidden focus:border-gabarito-brown bg-white font-mono"
                      />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleProcessStudentsAI}
                          disabled={isProcessingStudents || !rawStudentsText.trim()}
                          className="flex-1 bg-gabarito-brown hover:bg-[#43291c] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-55 cursor-pointer"
                        >
                          {isProcessingStudents ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Processando nomes com IA...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Processar Lista com IA
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Cleaned AI Output */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col justify-between min-h-[220px]">
                      <div>
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                          <h4 className="font-bold text-stone-800 text-sm">Alunos Higienizados pela IA</h4>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                            {parsedStudents.length} Detectados
                          </span>
                        </div>

                        {importMessage && (
                          <div className="mb-3 p-2 bg-stone-50 border border-stone-200 rounded-lg text-[11px] text-stone-600 flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                            <span>{importMessage}</span>
                          </div>
                        )}

                        {parsedStudents.length === 0 ? (
                          <div className="text-center py-12 text-stone-400 text-xs">
                            {isProcessingStudents 
                              ? "Aguarde, a IA está removendo números, corrigindo maiúsculas e organizando os dados..." 
                              : "Cole o texto bruto ao lado e clique em 'Processar Lista' para visualizar a lista limpa aqui."}
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                            {parsedStudents.map((studentName, i) => (
                              <div key={i} className="text-xs py-1 px-2 bg-stone-50 rounded-md border border-stone-100 font-medium text-stone-800 flex justify-between">
                                <span>{i + 1}. {studentName}</span>
                                <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">OK</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {parsedStudents.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-stone-100 space-y-3">
                          <div className="flex items-center gap-2 justify-between">
                            <label className="text-xs font-bold text-stone-700">Salvar na Turma:</label>
                            <select
                              value={targetClassForImport}
                              onChange={(e) => setTargetClassForImport(e.target.value)}
                              className="text-xs p-1.5 border border-stone-300 rounded-lg bg-stone-50"
                            >
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={handleSaveImportedStudents}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition"
                          >
                            Salvar Alunos na Turma
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: CRIA GABARITOS OFICIAIS */}
              {activeTab === "gabarito" && (
                <motion.div
                  key="gabarito-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-gabarito-brown" />
                        Gerador de Gabarito Oficial
                      </h3>
                      <p className="text-stone-500 text-xs mt-0.5">
                        Defina o número de questões e as respostas corretas do seu teste oficial.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-stone-700">Nº Questões:</label>
                      <select
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value) as any)}
                        className="text-xs p-1.5 border border-stone-300 rounded-lg bg-white font-bold"
                      >
                        <option value={5}>5 Questões</option>
                        <option value={10}>10 Questões</option>
                        <option value={15}>15 Questões</option>
                        <option value={20}>20 Questões</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-stone-200">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-stone-100 pb-3">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Configure o Gabarito Principal:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRandomOfficialKey}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium py-1 px-3 rounded-lg transition"
                        >
                          Preencher Aleatório
                        </button>
                        <button
                          onClick={() => setOfficialKey(prev => prev.map(k => ({ ...k, correctAnswer: "" })))}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium py-1 px-3 rounded-lg transition"
                        >
                          Limpar Tudo
                        </button>
                      </div>
                    </div>

                    {/* Bubble Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      {officialKey.map((key) => (
                        <div 
                          key={key.questionNumber}
                          className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg border border-stone-100"
                        >
                          <span className="font-bold text-stone-700 text-sm">
                            Questão {String(key.questionNumber).padStart(2, "0")}:
                          </span>
                          
                          <div className="flex gap-2">
                            {(["A", "B", "C", "D", "E"] as const).map((letter) => {
                              const isSelected = key.correctAnswer === letter;
                              return (
                                <button
                                  key={letter}
                                  onClick={() => handleSetOfficialBubble(key.questionNumber, letter)}
                                  className={`w-8 h-8 rounded-full border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? "bg-gabarito-brown text-white border-gabarito-brown scale-105 shadow-xs"
                                      : "border-stone-300 text-stone-600 hover:border-stone-500 hover:bg-stone-50"
                                  }`}
                                >
                                  {letter}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
                      <button
                        onClick={handleSaveOfficialKey}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-xl text-xs transition cursor-pointer"
                      >
                        Salvar e Prosseguir para Correção
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: CORRIGE PROVAS POR FOTO */}
              {activeTab === "corrigir" && (
                <motion.div
                  key="corrigir-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-gabarito-brown animate-pulse" />
                      Módulo de Correção Inteligente
                    </h3>
                    <p className="text-stone-500 text-xs mt-0.5">
                      Corrija simulando os gabaritos dos alunos ou fazendo upload da foto real de uma prova.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Simulator Config / Input side */}
                    <div className="lg:col-span-5 space-y-4">
                      
                      {/* Sub-Card: Selector of test method */}
                      <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Método de Teste:</span>
                        
                        {/* Simulation Tab */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-stone-600">Nome do Aluno:</label>
                          <input 
                            type="text"
                            value={graderStudentName}
                            onChange={(e) => setGraderStudentName(e.target.value)}
                            className="w-full text-xs p-2 border border-stone-300 rounded-lg bg-stone-50"
                            placeholder="Matheus Silva, etc."
                          />
                        </div>

                        <div className="bg-amber-50/50 p-2 border border-amber-100/50 rounded-lg text-[10px] text-amber-900 flex items-start gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>Clique nas bolinhas abaixo para simular as respostas que o aluno marcou na prova física.</span>
                        </div>

                        {/* Interactive simulation bubbles */}
                        <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                          {officialKey.map((key) => {
                            const studentMarked = studentKey[key.questionNumber] || "";
                            return (
                              <div key={key.questionNumber} className="flex items-center justify-between py-1 px-2 hover:bg-stone-50 rounded-md border border-stone-100">
                                <span className="text-[11px] font-bold text-stone-600">Q{key.questionNumber}:</span>
                                <div className="flex gap-1">
                                  {(["A", "B", "C", "D", "E"] as const).map((letter) => {
                                    const isMarked = studentMarked === letter;
                                    return (
                                      <button
                                        key={letter}
                                        onClick={() => handleSetStudentBubble(key.questionNumber, letter)}
                                        className={`w-6 h-6 rounded-full border text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                                          isMarked 
                                            ? "bg-stone-700 text-white border-stone-700" 
                                            : "border-stone-300 text-stone-500 hover:bg-stone-100"
                                        }`}
                                      >
                                        {letter}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          onClick={handleGradeMockExam}
                          disabled={isGrading}
                          className="w-full bg-gabarito-brown hover:bg-[#43291c] text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
                        >
                          {isGrading ? "Escaneando Gabarito..." : "Corrigir Respostas do Aluno ⚡"}
                        </button>
                      </div>

                      {/* Photo upload block (Real AI option) */}
                      <div className="bg-white p-4 rounded-xl border border-stone-200 text-center space-y-3">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Ou Envie uma Foto Real da Prova:</span>
                        
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-stone-300 rounded-xl hover:border-gabarito-brown hover:bg-stone-50/50 cursor-pointer transition">
                          <Upload className="w-6 h-6 text-stone-400 mb-1" />
                          <span className="text-xs font-bold text-stone-700">Escolha um arquivo ou foto</span>
                          <span className="text-[10px] text-stone-400 mt-1">PNG, JPG de gabarito preenchido</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleUploadPhoto}
                            className="hidden" 
                          />
                        </label>
                        
                        <div className="text-[10px] text-stone-500 text-left bg-stone-50 p-2 rounded-lg border border-stone-200">
                          <span className="font-bold text-stone-700 block mb-0.5">💡 Como funciona o scanner:</span>
                          O sistema compara a foto real enviada com as respostas corretas configuradas na aba <b>"Cria gabaritos oficiais"</b>.
                        </div>
                      </div>

                    </div>

                    {/* Scanner / Results output side */}
                    <div className="lg:col-span-7 flex flex-col justify-start">
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 min-h-[420px] flex flex-col justify-between relative overflow-hidden">
                        
                        {/* Scanning animation layer */}
                        {isGrading && (
                          <div className="absolute inset-0 bg-[#553625]/5 flex flex-col items-center justify-center z-10">
                            {/* Visual laser line scanner */}
                            <motion.div 
                              className="w-full h-1.5 bg-emerald-500 shadow-[0_0_12px_#10b981] absolute left-0"
                              animate={{ top: ["5%", "95%", "5%"] }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            />
                            
                            <div className="bg-white px-4 py-3 rounded-xl shadow-md border border-stone-200 text-center space-y-2">
                              <RefreshCw className="w-6 h-6 text-[#553625] animate-spin mx-auto" />
                              <p className="text-xs font-bold text-stone-800">Processando e Corrigindo Prova...</p>
                              {uploadProgress && <p className="text-[10px] text-stone-500 animate-pulse">{uploadProgress}</p>}
                            </div>
                          </div>
                        )}

                        {!isGrading && !gradedResult && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-400">
                            <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center border border-stone-100 mb-3">
                              <FileText className="w-8 h-8 text-stone-300" />
                            </div>
                            <h4 className="font-bold text-stone-700 text-sm mb-1">Aguardando Prova para Correção</h4>
                            <p className="text-xs max-w-sm">
                              Clique em "Corrigir Respostas do Aluno" ou envie uma foto para que o sistema gere as notas e o relatório pedagógico inteligente com IA.
                            </p>
                          </div>
                        )}

                        {gradedResult && (
                          <div className="space-y-5 animate-fadeIn">
                            {/* Grading Header Results */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-stone-100 pb-4">
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-stone-100 border border-stone-200 text-stone-700 rounded-md">
                                  {gradedResult.mode === "gemini_api" ? "Inteligência Artificial Ativa" : "Simulador Local"}
                                </span>
                                <h4 className="text-lg font-bold text-stone-900 mt-1">
                                  Resultados: {gradedResult.studentName}
                                </h4>
                                <p className="text-stone-500 text-xs mt-0.5">
                                  Acertou {gradedResult.correctCount} de {gradedResult.totalQuestions} questões
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <span className="text-[10px] text-stone-400 block font-bold">NOTA FINAL</span>
                                  <span className={`text-3xl font-black ${
                                    gradedResult.score >= 6.0 ? "text-emerald-600" : "text-amber-600"
                                  }`}>
                                    {gradedResult.score.toFixed(1)}
                                  </span>
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                                  gradedResult.score >= 6.0 ? "bg-emerald-600" : "bg-amber-600"
                                }`}>
                                  <Award className="w-6 h-6" />
                                </div>
                              </div>
                            </div>

                            {/* Question correction matrix */}
                            <div>
                              <span className="text-xs font-bold text-stone-700 block mb-2">Detalhamento das Questões:</span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {officialKey.map((key, idx) => {
                                  const correctAns = key.correctAnswer;
                                  const studAns = gradedResult.studentAnswers[idx];
                                  const isCorrect = studAns === correctAns;
                                  return (
                                    <div 
                                      key={key.questionNumber}
                                      className={`p-2 rounded-lg border text-xs flex flex-col justify-between ${
                                        isCorrect 
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                                          : "bg-red-50 border-red-200 text-red-900"
                                      }`}
                                    >
                                      <div className="flex justify-between items-center font-bold mb-1">
                                        <span>Q{key.questionNumber}</span>
                                        <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>
                                          {isCorrect ? "✓" : "✗"}
                                        </span>
                                      </div>
                                      <div className="text-[10px] flex justify-between">
                                        <span>Gabarito: <b>{correctAns || "?"}</b></span>
                                        <span>Marcou: <b className="underline">{studAns || "N/A"}</b></span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Pedagogical feedback (Gemini generated) */}
                            <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-4 space-y-1.5">
                              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                Relatório Pedagógico com IA (Gemini 2.5)
                              </span>
                              <p className="text-stone-700 text-xs leading-relaxed">
                                {gradedResult.aiFeedback}
                              </p>
                            </div>

                            {gradedResult.message && (
                              <p className="text-[9px] text-stone-400 italic text-right">
                                {gradedResult.message}
                              </p>
                            )}

                          </div>
                        )}

                        {/* Reset button for simulator */}
                        {gradedResult && (
                          <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
                            <button
                              onClick={() => setGradedResult(null)}
                              className="border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold py-2 px-4 rounded-xl transition"
                            >
                              Corrigir Próxima Prova
                            </button>
                          </div>
                        )}

                      </div>
                    </div>

                  </div>

                  {/* Real-time Cloud Corrections History */}
                  {user && (
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#553625]" />
                            Histórico de Correções em Tempo Real (Nuvem)
                          </h4>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Lista sincronizada automaticamente com o Firebase Firestore para esta turma.
                          </p>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-[#553625] px-2.5 py-1 rounded-full font-bold">
                          {historicResults.length} Registros
                        </span>
                      </div>

                      {historicResults.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-xs">
                          Nenhuma prova corrigida para esta turma no banco de dados na nuvem ainda. Realize a primeira correção acima!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                          {historicResults.map((hist, index) => {
                            const formattedDate = hist.createdAt && (hist.createdAt as any).seconds
                              ? new Date((hist.createdAt as any).seconds * 1000).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : "Recentemente";

                            return (
                              <div key={index} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col justify-between hover:shadow-xs transition">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-start">
                                    <span className="font-bold text-stone-900 text-xs truncate max-w-[130px]">{hist.studentName}</span>
                                    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                                      hist.score >= 6.0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                    }`}>
                                      {hist.score.toFixed(1)}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-stone-500">
                                    Acertos: {hist.correctCount}/{hist.totalQuestions} • {formattedDate}
                                  </p>
                                </div>
                                {hist.aiFeedback && (
                                  <div className="mt-2 pt-2 border-t border-stone-200 text-[10px] text-stone-600 line-clamp-2 italic">
                                    "{hist.aiFeedback}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </section>

        {/* FAQ SECTION / SYSTEM INFO */}
        <section className="bg-white rounded-2xl shadow-xs p-6 md:p-8 space-y-6">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-100 pb-3">
            Guia de Configuração e Uso Profissional
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Como ativar a Inteligência Artificial Real?
              </h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                Este applet está totalmente preparado para usar a API oficial do <b>Gemini 2.5 Flash</b>. Para digitalizar fotos de provas reais e higienizar dados com IA real, você só precisa ir até as Configurações (Secrets) do seu painel do AI Studio e adicionar o segredo <code>GEMINI_API_KEY</code> com a sua chave obtida gratuitamente no Google AI Studio.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Como gerar as Folhas de Resposta para os alunos?
              </h4>
              <p className="text-stone-600 text-xs leading-relaxed">
                Você pode usar o gerador na aba <b>"Cria gabaritos oficiais"</b> para definir as respostas. No aplicativo Android, há uma opção de compartilhamento que gera uma imagem em PDF do gabarito pronto para impressão. Os alunos preenchem as bolinhas pretas e você só precisa tirar uma foto para ver os resultados!
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-stone-100 border-t border-stone-200 py-6 text-center text-xs text-stone-500 relative">
        <p>© 2026 Gabarito IA - Correção inteligente de provas com Inteligência Artificial.</p>
        <p className="mt-1">
          Desenvolvido em conformidade para professores de todo o Brasil.
          <button 
            onClick={() => { setShowPinPrompt(true); setPinInput(""); setPinError(""); }}
            className="ml-2 px-2 py-0.5 rounded-md text-[10px] bg-stone-200/50 hover:bg-stone-200 text-stone-600 transition cursor-pointer font-medium font-mono inline-block align-middle"
            title="Acessar Painel Admin"
            id="hidden-admin-btn"
          >
            Painel Admin
          </button>
        </p>
      </footer>

      {/* PIN PROMPT MODAL */}
      <AnimatePresence>
        {showPinPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setShowPinPrompt(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xl font-bold">
                  🔑
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Digite o PIN</h3>
              </div>

              <div className="space-y-3">
                <input 
                  type="password"
                  placeholder="Digite o PIN"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerifyPin();
                  }}
                  className="w-full text-center px-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono tracking-widest text-lg focus:outline-hidden focus:border-amber-500 transition-colors"
                />
                
                {pinError && (
                  <p className="text-rose-400 text-xs text-center font-medium animate-pulse">
                    {pinError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowPinPrompt(false)}
                    className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-300 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVerifyPin}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-stone-950 transition cursor-pointer"
                  >
                    Confirmar PIN
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADMIN PANEL MODAL */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setShowAdminPanel(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                  <div>
                    <h3 className="text-base font-black tracking-tight text-white uppercase font-mono">
                      PAINEL ADMINISTRATIVO SECRETO
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Ambiente restrito para depuração, simulação e monitoramento.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="text-stone-400 hover:text-white text-xs bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-xl transition cursor-pointer font-bold"
                >
                  Fechar [ESC]
                </button>
              </div>

              {/* Server / Firestore Status Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800/80">
                  <span className="text-[10px] text-stone-500 block uppercase font-mono">Sessão Cloud</span>
                  <span className="text-xs font-bold font-mono text-emerald-400 truncate block">
                    {user ? "ATIVADA" : "DESCONECTADO"}
                  </span>
                </div>
                <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800/80">
                  <span className="text-[10px] text-stone-500 block uppercase font-mono">Turmas em Cache</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {classes.length}
                  </span>
                </div>
                <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800/80">
                  <span className="text-[10px] text-stone-500 block uppercase font-mono">Questões Atual</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {numQuestions}
                  </span>
                </div>
                <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800/80">
                  <span className="text-[10px] text-stone-500 block uppercase font-mono">Histórico Local</span>
                  <span className="text-sm font-bold font-mono text-blue-400">
                    {historicResults.length}
                  </span>
                </div>
              </div>

              {/* Salvar APK para o cliente baixar */}
              <div className="space-y-3 bg-stone-950/40 p-4 rounded-2xl border border-stone-800/80">
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wider text-stone-300 border-b border-stone-800 pb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  Deixar salvo o arquivo APK para o cliente baixar
                </h4>
                
                <div className="text-xs space-y-2">
                  <p className="text-stone-400 leading-relaxed">
                    Faça o upload do seu arquivo APK personalizado para que o botão "Baixar APK" entregue o seu aplicativo real aos usuários diretamente do servidor.
                  </p>

                  {/* Status do APK */}
                  <div className="p-3 bg-stone-950 rounded-xl border border-stone-800/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-500 block uppercase font-mono">STATUS DO DOWNLOAD</span>
                      <span className={`font-bold font-mono text-xs ${customApkInfo?.customApkExists ? "text-emerald-400" : "text-amber-400"}`}>
                        {customApkInfo?.customApkExists ? "✓ APK PERSONALIZADO ATIVO" : "ℹ APK SIMULADO ATIVO (PADRÃO)"}
                      </span>
                      {customApkInfo?.customApkExists && (
                        <p className="text-[10px] text-stone-400 mt-1">
                          Nome original: <b className="text-white">{customApkInfo.originalName}</b> ({(customApkInfo.size ? customApkInfo.size / 1024 / 1024 : 0).toFixed(2)} MB)<br/>
                          Salvo em: {customApkInfo.uploadedAt ? new Date(customApkInfo.uploadedAt).toLocaleString() : ""}
                        </p>
                      )}
                    </div>

                    {customApkInfo?.customApkExists && (
                      <button
                        onClick={handleDeleteCustomApk}
                        className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-[10px] text-rose-300 font-bold font-mono transition cursor-pointer"
                      >
                        Reverter p/ Simulado
                      </button>
                    )}
                  </div>

                  {/* Upload input */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-bold text-stone-300">Fazer Upload de Novo APK:</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="file"
                        accept=".apk"
                        onChange={handleApkUpload}
                        id="admin-apk-upload"
                        className="hidden"
                        disabled={apkUploading}
                      />
                      <label 
                        htmlFor="admin-apk-upload"
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-mono cursor-pointer flex items-center gap-1.5 transition ${
                          apkUploading 
                            ? "bg-stone-800 text-stone-500 border border-stone-700" 
                            : "bg-blue-600 hover:bg-blue-500 text-white hover:shadow-md"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {apkUploading ? "Enviando arquivo..." : "Selecionar arquivo .apk"}
                      </label>
                      <span className="text-[10px] text-stone-500">Limitação recomendada: até 100MB</span>
                    </div>

                    {apkSuccess && (
                      <p className="text-emerald-400 text-xs font-medium font-mono">✓ {apkSuccess}</p>
                    )}
                    {apkError && (
                      <p className="text-rose-400 text-xs font-medium font-mono">✗ {apkError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Gerenciamento de Links */}
              <div className="space-y-3 bg-stone-950/40 p-4 rounded-2xl border border-stone-800/80">
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wider text-stone-300 border-b border-stone-800 pb-1.5 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  Atualizar Links Globais (Entrar no PC e Compartilhar)
                </h4>
                
                <div className="text-xs space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-300">Link "Entrar com o PC":</label>
                    <input
                      type="text"
                      placeholder="Ex: https://gabarito-ia-prof.base44.app/login"
                      value={pcLinkInput}
                      onChange={(e) => setPcLinkInput(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-300">Link "Compartilhar Página" (Deixe em branco para usar o endereço atual):</label>
                    <input
                      type="text"
                      placeholder="Ex: https://meu-gabarito.com"
                      value={shareLinkInput}
                      onChange={(e) => setShareLinkInput(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-white font-mono text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {settingsSuccess && (
                        <p className="text-emerald-400 text-xs font-medium font-mono">✓ {settingsSuccess}</p>
                      )}
                      {settingsError && (
                        <p className="text-rose-400 text-xs font-medium font-mono">✗ {settingsError}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSaveAppSettings(pcLinkInput, shareLinkInput)}
                      disabled={isSavingSettings}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-bold text-xs rounded-xl transition cursor-pointer font-mono"
                    >
                      {isSavingSettings ? "Salvando..." : "Salvar Configurações"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Gerenciamento do PIN */}
              <div className="space-y-3 bg-stone-950/40 p-4 rounded-2xl border border-stone-800/80">
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wider text-stone-300 border-b border-stone-800 pb-1.5 flex items-center gap-1.5">
                  <span>🔑</span>
                  PIN de Segurança do Painel Administrativo
                </h4>
                
                <div className="text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <p className="text-stone-400">
                        O PIN de segurança protege o acesso ao Painel Administrativo contra acessos não autorizados de terceiros.
                      </p>
                      <p className="text-[10px] text-stone-500 mt-1 font-mono">
                        PIN Atual Ativo: <span className="text-amber-400 font-bold">{adminPin}</span>
                      </p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Novo PIN"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-24 px-3 py-1.5 bg-stone-950 border border-stone-800 rounded-xl text-center text-white font-mono text-sm tracking-widest focus:outline-hidden focus:border-amber-500"
                      />
                      <button
                        onClick={handleChangePin}
                        disabled={changingPin || !newPinInput}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-xs rounded-xl transition cursor-pointer font-mono shrink-0"
                      >
                        {changingPin ? "Salvando..." : "Alterar PIN"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-white uppercase font-mono tracking-wider text-stone-400 border-b border-stone-800 pb-1">
                  Gerenciamento de Simulação & Massa de Dados
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleGenerateAdminMockData}
                    className="flex flex-col text-left p-3 rounded-2xl bg-[#1b3a24] hover:bg-[#234c2f] border border-[#2d5c3b] transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-emerald-300">Gerar Massa de Dados na Nuvem</span>
                    <span className="text-[10px] text-emerald-200/80 mt-1">
                      Injeta automaticamente 1 turma de teste, 5 alunos com gabarito oficial e 3 correções de histórico no Firestore.
                    </span>
                  </button>

                  <button
                    onClick={handleClearAdminMockData}
                    className="flex flex-col text-left p-3 rounded-2xl bg-[#441d1d] hover:bg-[#582727] border border-[#6b3131] transition cursor-pointer"
                  >
                    <span className="font-bold text-xs text-rose-300">Excluir Turma Selecionada</span>
                    <span className="text-[10px] text-rose-200/80 mt-1">
                      Remove a turma selecionada do Firestore em cascata com todos os sub-documentos para reiniciar testes.
                    </span>
                  </button>
                </div>
              </div>

              {/* Firewalls & Rules Info */}
              <div className="space-y-2 bg-stone-950 p-4 rounded-2xl border border-stone-800/80 font-mono text-[11px] text-stone-400 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-amber-500 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>REGRA DE SEGURANÇA FIRESTORE ATIVADA</span>
                </div>
                <p>✓ <b>Validação de Dono:</b> Apenas proprietários autenticados podem ler ou escrever suas turmas, alunos e gabaritos.</p>
                <p>✓ <b>Bloqueio de Invasão:</b> Tentativas de alteração de <code>ownerId</code> em trânsito são rejeitadas na camada do Firebase.</p>
                <p>✓ <b>Limites de Prova:</b> Gabaritos oficiais com tamanho fora do intervalo (5-20) e notas fora de (0-10) causam rejeição automática.</p>
              </div>

              {/* Footer detail */}
              <div className="text-center pt-2 border-t border-stone-800 text-[10px] text-stone-500 font-mono">
                SISTEMA OPERACIONAL GABARITO IA • v1.4.2 • DESENVOLVIMENTO
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
