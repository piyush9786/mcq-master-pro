import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import PracticePage from "./pages/PracticePage";
import ExamPage from "./pages/ExamPage";
import ResultsPage from "./pages/ResultsPage";
import WrongQuestionsPage from "./pages/WrongQuestionsPage";
import ImportExportPage from "./pages/ImportExportPage";
import SubjectsPage from "./pages/SubjectsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/exam" element={<ExamPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/wrong-questions" element={<WrongQuestionsPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/import-export" element={<ImportExportPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
