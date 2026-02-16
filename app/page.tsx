"use client";

import { ChangeEvent, useMemo, useState } from "react";

type QuizMode = "open" | "mc" | "both";

type Question = {
  id: string;
  type: "Open vraag" | "Meerkeuze";
  prompt: string;
  options?: string[];
  answer?: string;
  tip?: string;
};

const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".js",
  ".ts",
  ".py",
  ".java",
  ".css",
  ".sql",
  ".yaml",
  ".yml",
  ".rtf",
  ".log",
  ".ini",
  ".tex",
  ".srt",
  ".vtt",
];

const ACCEPTED_FILE_TYPES = [
  ".txt,.md,.csv,.tsv,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.go,.php,.rb,.rs,.sql,.yaml,.yml,.rtf,.log,.ini,.tex,.srt,.vtt",
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods",
  "image/*,audio/*,video/*",
].join(",");

function splitIntoSentences(input: string) {
  return input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 25);
}

function extractKeywords(input: string) {
  const stopWords = new Set([
    "de",
    "het",
    "een",
    "en",
    "van",
    "voor",
    "met",
    "that",
    "this",
    "from",
    "zijn",
    "wordt",
    "zijn",
    "the",
    "naar",
    "door",
    "about",
    "zoals",
    "maar",
    "zodat",
    "waar",
    "which",
  ]);

  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stopWords.has(word));

  const frequencies = new Map<string, number>();
  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);
}

function buildQuiz(content: string, mode: QuizMode, amount: number) {
  const sentences = splitIntoSentences(content);
  const keywords = extractKeywords(content);

  const openQuestions: Question[] = keywords.slice(0, amount).map((keyword, index) => ({
    id: `open-${index}`,
    type: "Open vraag",
    prompt: `Leg in je eigen woorden uit waarom "${keyword}" belangrijk is binnen de leerstof.`,
    tip: `Gebruik minstens 2 voorbeelden uit je tekst of bestanden.`,
  }));

  const mcQuestions: Question[] = sentences.slice(0, amount).map((sentence, index) => {
    const correctTerm = keywords[index] ?? "kernbegrip";
    const distractors = keywords
      .filter((word) => word !== correctTerm)
      .slice(index + 1, index + 4);

    const options = [correctTerm, ...distractors];
    while (options.length < 4) {
      options.push(`alternatief-${options.length}`);
    }

    const shuffled = [...options].sort(() => Math.random() - 0.5);

    return {
      id: `mc-${index}`,
      type: "Meerkeuze",
      prompt: `Welke term past het best bij deze context? "${sentence.slice(0, 130)}..."`,
      options: shuffled,
      answer: correctTerm,
    };
  });

  if (mode === "open") return openQuestions;
  if (mode === "mc") return mcQuestions;

  const combined: Question[] = [];
  for (let i = 0; i < amount; i++) {
    if (openQuestions[i]) combined.push(openQuestions[i]);
    if (mcQuestions[i]) combined.push(mcQuestions[i]);
  }

  return combined;
}

export default function Home() {
  const [mode, setMode] = useState<QuizMode>("both");
  const [questionCount, setQuestionCount] = useState(6);
  const [manualText, setManualText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [sourcePreview, setSourcePreview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const stats = useMemo(() => {
    const open = quiz.filter((q) => q.type === "Open vraag").length;
    const mc = quiz.filter((q) => q.type === "Meerkeuze").length;
    return { open, mc, total: quiz.length };
  }, [quiz]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setUploadedFiles(files);
  };

  const readFileSafely = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isTextBased =
      file.type.startsWith("text/") || TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!isTextBased) {
      return `Bestandsnaam: ${file.name} (inhoudstype: ${file.type || "onbekend"}).`;
    }

    try {
      const text = await file.text();
      return `Bestandsnaam: ${file.name}\n${text.slice(0, 12000)}`;
    } catch {
      return `Bestandsnaam: ${file.name}. Inhoud kon niet worden gelezen, maar metadata is wel meegenomen.`;
    }
  };

  const generateQuiz = async () => {
    setIsGenerating(true);
    const fileContentChunks = await Promise.all(uploadedFiles.map((file) => readFileSafely(file)));

    const totalContent = [manualText, ...fileContentChunks].join("\n\n").trim();

    if (totalContent.length < 80) {
      setQuiz([]);
      setSourcePreview("");
      setIsGenerating(false);
      return;
    }

    setSourcePreview(totalContent.slice(0, 500));
    setQuiz(buildQuiz(totalContent, mode, questionCount));
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-10">
      <main className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            Slimme Oefentoets Generator
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Upload je lesmateriaal en maak automatisch een oefentoets
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            Voor studenten gemaakt: upload meerdere bestanden, plak extra tekst en kies direct of je open
            vragen, multiple choice of een mix wilt. Ondersteunt heel veel bestandstypes; tekstbestanden
            worden inhoudelijk gelezen en andere bestanden worden slim meegenomen via metadata.
          </p>

          <div className="mt-6 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">1) Upload bestanden</span>
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileSelect}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
              />
              <span className="text-xs text-slate-500">
                Geselecteerd: {uploadedFiles.length} bestand(en)
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">2) Of plak je eigen tekst</span>
              <textarea
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                rows={8}
                placeholder="Plak hier samenvattingen, slides-notities of leerdoelen..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">3) Kies vraagtype</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as QuizMode)}
                  className="rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="both">Combinatie (open + multiple choice)</option>
                  <option value="open">Alleen open vragen</option>
                  <option value="mc">Alleen multiple choice</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">4) Aantal vragen</span>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={generateQuiz}
              disabled={isGenerating}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isGenerating ? "Oefentoets wordt gemaakt..." : "Genereer oefentoets"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <h2 className="text-xl font-bold">Jouw toetsoverzicht</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-slate-300">Totaal</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-slate-300">Open</p>
              <p className="text-lg font-bold">{stats.open}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-slate-300">MC</p>
              <p className="text-lg font-bold">{stats.mc}</p>
            </div>
          </div>

          {sourcePreview ? (
            <p className="mt-5 rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs leading-5 text-slate-300">
              <strong>Bron-preview:</strong> {sourcePreview}...
            </p>
          ) : (
            <p className="mt-5 text-sm text-slate-300">
              Nog geen broninhoud verwerkt. Upload bestanden of plak tekst en klik op{' '}
              <strong>Genereer oefentoets</strong>.
            </p>
          )}
        </aside>
      </main>

      <section className="mx-auto mt-6 w-full max-w-6xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <h2 className="text-2xl font-bold">Automatisch gegenereerde vragen</h2>
        {quiz.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Tip: gebruik minimaal een paar alinea&apos;s tekst voor betere vragenkwaliteit.
          </p>
        ) : (
          <ol className="mt-5 grid gap-4">
            {quiz.map((question, index) => (
              <li key={question.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{question.type}</p>
                <p className="mt-2 font-medium">
                  {index + 1}. {question.prompt}
                </p>

                {question.options ? (
                  <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                    {question.options.map((option) => (
                      <li key={option} className="rounded-lg bg-slate-100 px-3 py-2">
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {question.tip ? <p className="mt-3 text-xs text-slate-500">💡 {question.tip}</p> : null}
                {question.answer ? (
                  <p className="mt-2 text-xs text-emerald-700">Modelantwoord: {question.answer}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
