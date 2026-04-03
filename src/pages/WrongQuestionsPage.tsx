import { useEffect, useState } from 'react';
import { getWrongQuestions, getQuestions, setWrongQuestions } from '@/lib/storage';
import { WrongQuestion, Question } from '@/types/mcq';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';

export default function WrongQuestionsPage() {
  const [wrongs, setWrongs] = useState<WrongQuestion[]>([]);
  const [questions, setQuestionsList] = useState<Question[]>([]);
  const [filterSubject, setFilterSubject] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setWrongs(getWrongQuestions().filter(w => !w.corrected));
    setQuestionsList(getQuestions());
  }, []);

  const subjects = [...new Set(wrongs.map(w => w.subject))].sort();
  const filtered = filterSubject === 'all' ? wrongs : wrongs.filter(w => w.subject === filterSubject);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const clearAll = () => {
    setWrongQuestions([]);
    setWrongs([]);
  };

  const downloadAsPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(18);
    doc.text('Wrong Questions', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Subject: ${filterSubject === 'all' ? 'All' : filterSubject} • ${filtered.length} questions`, margin, y);
    doc.setTextColor(0);
    y += 12;

    filtered.forEach((w, idx) => {
      const q = questions.find(x => x.id === w.questionId);
      if (!q) return;

      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const qLines = doc.splitTextToSize(`${idx + 1}. ${q.question}`, maxWidth);
      doc.text(qLines, margin, y);
      y += qLines.length * 5 + 3;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      q.options.forEach((opt, oi) => {
        if (y > 275) { doc.addPage(); y = 20; }
        const prefix = oi === q.answer ? '✓ ' : '  ';
        const optLines = doc.splitTextToSize(`${prefix}${String.fromCharCode(65 + oi)}. ${opt}`, maxWidth - 5);
        if (oi === q.answer) {
          doc.setTextColor(34, 139, 34);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(optLines, margin + 5, y);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        y += optLines.length * 5 + 1;
      });

      y += 2;
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setTextColor(100);
      const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, maxWidth - 5);
      doc.text(expLines, margin + 5, y);
      doc.setTextColor(0);
      y += expLines.length * 4 + 2;

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Attempts: ${w.attempts} • Last: ${new Date(w.lastAttemptDate).toLocaleDateString()}`, margin + 5, y);
      doc.setTextColor(0);
      y += 10;

      doc.setDrawColor(220);
      doc.line(margin, y - 4, pageWidth - margin, y - 4);
      y += 2;
    });

    doc.save(`wrong-questions-${filterSubject}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Wrong Questions</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} questions to review</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={downloadAsPdf} title="Download PDF"><Download className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={clearAll}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            No wrong questions! Keep it up! 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(w => {
            const q = questions.find(x => x.id === w.questionId);
            if (!q) return null;
            const isOpen = expanded.has(w.questionId);
            return (
              <Card key={w.questionId} className="glass-card">
                <CardContent className="p-4">
                  <button className="w-full text-left flex items-center justify-between" onClick={() => toggle(w.questionId)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="secondary" className="shrink-0">{q.subject}</Badge>
                      <p className="text-sm font-medium truncate">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{w.attempts}x wrong</span>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-4 space-y-2 animate-fade-in">
                      <div className="space-y-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-sm px-3 py-1.5 rounded ${i === q.answer ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground italic p-2 bg-muted/50 rounded">{q.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
