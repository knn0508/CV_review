import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavIsland from "./components/NavIsland";
import Dashboard from "./pages/Dashboard";
import NewJob from "./pages/NewJob";
import UploadCVs from "./pages/UploadCVs";
import Ranking from "./pages/Ranking";
import CandidateReview from "./pages/CandidateReview";

export default function App() {
  return (
    <BrowserRouter>
      <div className="grain min-h-dvh">
        <NavIsland />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs/new" element={<NewJob />} />
          <Route path="/upload" element={<UploadCVs />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/cvs/:cvId/review" element={<CandidateReview />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
