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
  source?: string;
};

type KeywordScore = {
  word: string;
  score: number;
};

const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".html",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
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

const STOP_WORDS = new Set([
  "de",
  "het",
  "een",
  "en",
  "van",
  "voor",
  "met",
  "zijn",
  "wordt",
  "naar",
  "door",
  "zoals",
  "maar",
  "zodat",
  "waar",
  "onder",
  "tussen",
  "zonder",
  "over",
  "aan",
  "op",
  "bij",
  "die",
  "dit",
  "deze",
  "that",
  "this",
  "from",
  "the",
  "about",
  "which",
  "when",
  "with",
  "into",
  "your",
  "their",
  "have",
  "were",
  "there",
]);

const MC_FALLBACK_OPTIONS = [
  "samenvatting",
  "casus",
  "model",
  "theorie",
  "toepassing",
  "analyse",
  "evaluatie",
  "methode",
];

function normalizeText(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function splitIntoSentences(input: string) {
  return input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 320);
}

function extractCandidateWords(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function scoreKeywords(input: string) {
  const words = extractCandidateWords(input);
  const frequencies = new Map<string, number>();

  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }

  const sentences = splitIntoSentences(input);
  const spread = new Map<string, number>();
  for (const sentence of sentences) {
    const uniqueWords = new Set(extractCandidateWords(sentence));
    uniqueWords.forEach((word) => {
      spread.set(word, (spread.get(word) ?? 0) + 1);
    });
  }

  const ranked: KeywordScore[] = [...frequencies.entries()].map(([word, frequency]) => ({
    word,
    score: frequency * 1.4 + (spread.get(word) ?? 0) * 1.8,
  }));

  return ranked.sort((a, b) => b.score - a.score).slice(0, 90);
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOpenQuestions(sentences: string[], keywords: KeywordScore[], amount: number) {
  const selectedSentences = shuffle(sentences).slice(0, amount * 2);

  const questions: Question[] = selectedSentences.slice(0, amount).map((sentence, index) => {
    const key = keywords[index % keywords.length]?.word ?? "kernbegrip";

    return {
      id: `open-${index}`,
      type: "Open vraag",
      prompt: `Leg uit wat "${key}" betekent in de context van de leerstof en gebruik de bron om je uitleg te onderbouwen.`,
      tip: "Noem minimaal 2 kernpunten en sluit af met een concreet voorbeeld.",
      answer: sentence,
      source: sentence,
    };
  });

  return questions;
}

function createClozeSentence(sentence: string, answer: string) {
  const pattern = new RegExp(`\\b${answer}\\b`, "i");
  if (!pattern.test(sentence)) {
    return null;
  }

  return sentence.replace(pattern, "____");
}

function buildMcQuestions(sentences: string[], keywords: KeywordScore[], amount: number) {
  const keywordPool = keywords.map((item) => item.word);
  const questions: Question[] = [];

  for (const sentence of sentences) {
    if (questions.length >= amount) {
      break;
    }

    const candidateWords = extractCandidateWords(sentence)
      .filter((word) => keywordPool.includes(word))
      .sort((a, b) => keywordPool.indexOf(a) - keywordPool.indexOf(b));

    const answer = candidateWords[0];
    if (!answer) {
      continue;
    }

    const cloze = createClozeSentence(sentence, answer);
    if (!cloze) {
      continue;
    }

    const distractors = dedupe(
      keywordPool.filter((word) => word !== answer && !sentence.toLowerCase().includes(word)).slice(0, 8),
    )
      .filter((word) => Math.abs(word.length - answer.length) <= 6)
      .slice(0, 3);

    const paddedDistractors = [...distractors];
    for (const fallback of MC_FALLBACK_OPTIONS) {
      if (paddedDistractors.length >= 3) {
        break;
      }
      if (fallback !== answer && !paddedDistractors.includes(fallback)) {
        paddedDistractors.push(fallback);
      }
    }

    const options = shuffle([answer, ...paddedDistractors].slice(0, 4));

    questions.push({
      id: `mc-${questions.length}`,
      type: "Meerkeuze",
      prompt: `Welke term past het best in de lege plek?\n\n${cloze}`,
      options,
      answer,
      tip: "Lees de zin helemaal en kies de term die inhoudelijk het best klopt.",
      source: sentence,
    });
  }

  return questions;
}

function buildQuiz(content: string, mode: QuizMode, amount: number) {
  const normalized = normalizeText(content);
  const sentences = splitIntoSentences(normalized);
  const keywords = scoreKeywords(normalized);

  if (sentences.length < 2 || keywords.length < 4) {
    return [];
  }

  const openQuestions = buildOpenQuestions(sentences, keywords, amount);
  const mcQuestions = buildMcQuestions(shuffle(sentences), keywords, amount);

  if (mode === "open") {
    return openQuestions.slice(0, amount);
  }

  if (mode === "mc") {
    return mcQuestions.slice(0, amount);
  }

  const combined: Question[] = [];
  let openIndex = 0;
  let mcIndex = 0;

  while (combined.length < amount && (openIndex < openQuestions.length || mcIndex < mcQuestions.length)) {
    if (openIndex < openQuestions.length) {
      combined.push(openQuestions[openIndex]);
      openIndex += 1;
    }

    if (combined.length >= amount) {
      break;
    }

    if (mcIndex < mcQuestions.length) {
      combined.push(mcQuestions[mcIndex]);
      mcIndex += 1;
    }
  }

  return combined.slice(0, amount);
}

export default function Home() {
  const [mode, setMode] = useState<QuizMode>("both");
  const [questionCount, setQuestionCount] = useState(8);
  const [manualText, setManualText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [sourcePreview, setSourcePreview] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const open = quiz.filter((q) => q.type === "Open vraag").length;
    const mc = quiz.filter((q) => q.type === "Meerkeuze").length;
    return { open, mc, total: quiz.length };
  }, [quiz]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const merged = [...uploadedFiles];
    const seen = new Set(merged.map((file) => `${file.name}-${file.size}-${file.lastModified}`));

    for (const file of files) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!seen.has(key)) {
        merged.push(file);
        seen.add(key);
      }
    }

    setUploadedFiles(merged);
    setFeedbackMessage(`${files.length} bestand(en) toegevoegd. Totaal: ${merged.length}.`);
    event.target.value = "";
  };

  const removeFile = (fileToRemove: File) => {
    const remaining = uploadedFiles.filter((file) => {
      return !(
        file.name === fileToRemove.name &&
        file.size === fileToRemove.size &&
        file.lastModified === fileToRemove.lastModified
      );
    });

    setUploadedFiles(remaining);
    setFeedbackMessage(`Bestand verwijderd. Nog ${remaining.length} bestand(en) geselecteerd.`);
  };

  const readFileSafely = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isTextBased =
      file.type.startsWith("text/") || TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!isTextBased) {
      return `Bestandscontext: ${file.name} (type: ${file.type || "onbekend"}, grootte: ${Math.round(file.size / 1024)} KB).`;
    }

    try {
      const text = await file.text();
      const normalized = normalizeText(text);

      if (normalized.length < 20) {
        return `Bestandscontext: ${file.name}. Dit bestand bevat erg weinig leesbare tekst.`;
      }

      return `Bestandsbron: ${file.name}\n${normalized.slice(0, 18000)}`;
    } catch {
      return `Bestandscontext: ${file.name}. De inhoud kon niet gelezen worden, maar bestandsinformatie is wel meegenomen.`;
    }
  };

  const generateQuiz = async () => {
    setIsGenerating(true);
    setFeedbackMessage(null);

    const safeAmount = Number.isFinite(questionCount)
      ? Math.max(4, Math.min(24, Math.round(questionCount)))
      : 8;

    const fileContentChunks = await Promise.all(uploadedFiles.map((file) => readFileSafely(file)));

    const totalContent = [manualText, ...fileContentChunks]
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (totalContent.length < 180) {
      setQuiz([]);
      setSourcePreview("");
      setFeedbackMessage(
        "Er is nog te weinig inhoud. Upload minstens één tekstbestand of plak enkele alinea's studietekst.",
      );
      setIsGenerating(false);
      return;
    }

    const nextQuiz = buildQuiz(totalContent, mode, safeAmount);

    if (nextQuiz.length < Math.min(4, safeAmount)) {
      setQuiz([]);
      setSourcePreview(totalContent.slice(0, 700));
      setFeedbackMessage(
        "Ik kon nog geen sterke vragen maken. Gebruik meer lopende tekst (uitlegzinnen) voor betere kwaliteit.",
      );
      setIsGenerating(false);
      return;
    }

    setQuiz(nextQuiz);
    setSourcePreview(totalContent.slice(0, 700));
    setFeedbackMessage(`Klaar! ${nextQuiz.length} vragen gegenereerd op basis van je bronmateriaal.`);
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
            Upload je lesmateriaal en maak betere oefenvragen
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            Vernieuwd voor studenten: betere vraagkwaliteit, sterkere multiple-choice opties en een
            betrouwbaarder bestandssysteem met meerdere uploads en verwijder-knoppen.
          </p>

          <div className="mt-6 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">1) Upload bestanden (je kunt meerdere keren kiezen)</span>
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileSelect}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
              />
            </label>

            {uploadedFiles.length > 0 ? (
              <ul className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                {uploadedFiles.map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {file.name} <span className="text-slate-500">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Verwijder
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

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
                  min={4}
                  max={24}
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

            {feedbackMessage ? (
              <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                {feedbackMessage}
              </p>
            ) : null}
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
            Tip: gebruik lopende uitlegzinnen in je bronmateriaal voor de beste kwaliteit.
          </p>
        ) : (
          <ol className="mt-5 grid gap-4">
            {quiz.map((question, index) => (
              <li key={question.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{question.type}</p>
                <p className="mt-2 whitespace-pre-line font-medium">
                  {index + 1}. {question.prompt}
                </p>

                {question.options ? (
                  <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                    {question.options.map((option) => (
                      <li key={`${question.id}-${option}`} className="rounded-lg bg-slate-100 px-3 py-2">
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {question.tip ? <p className="mt-3 text-xs text-slate-500">💡 {question.tip}</p> : null}
                {question.answer ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    Modelantwoord: <span className="font-medium">{question.answer}</span>
                  </p>
                ) : null}
                {question.source ? (
                  <p className="mt-2 text-xs text-slate-500">Bronzin: {question.source}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
