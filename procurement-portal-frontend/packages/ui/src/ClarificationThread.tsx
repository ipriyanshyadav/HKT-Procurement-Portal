import React, { useState } from "react";

export interface ClarificationItem {
  id: string;
  question: string;
  answer?: string | null;
  asked_by?: string | null;
  asked_by_vendor_id?: string | null;
  answered_at?: string | null;
  is_published: boolean;
  created_at: string;
}

export interface ClarificationThreadProps {
  rfqId: string;
  clarifications: ClarificationItem[];
  isBuyer?: boolean;
  onAskQuestion?: (question: string) => Promise<void>;
  onAnswerQuestion?: (clarificationId: string, answer: string, broadcast: boolean) => Promise<void>;
}

export const ClarificationThread: React.FC<ClarificationThreadProps> = ({
  clarifications,
  isBuyer = false,
  onAskQuestion,
  onAnswerQuestion,
}) => {
  const [newQuestion, setNewQuestion] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [broadcast, setBroadcast] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !onAskQuestion) return;
    setIsSubmitting(true);
    try {
      await onAskQuestion(newQuestion);
      setNewQuestion("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswer = async (id: string) => {
    if (!answerText.trim() || !onAnswerQuestion) return;
    setIsSubmitting(true);
    try {
      await onAnswerQuestion(id, answerText, broadcast);
      setAnsweringId(null);
      setAnswerText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">Clarifications & Q&A</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Vendor identities remain anonymous. Published clarifications are visible to all invited suppliers.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-full">
          {clarifications.length} Questions
        </span>
      </div>

      {/* Ask Question Box (for Suppliers) */}
      {!isBuyer && onAskQuestion && (
        <form onSubmit={handleAsk} className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Submit a Technical / Commercial Query
          </label>
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question to the procurement committee..."
            className="w-full text-sm border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newQuestion.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Send Question"}
            </button>
          </div>
        </form>
      )}

      {/* Clarification List */}
      <div className="space-y-4">
        {clarifications.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            No clarifications raised yet for this RFQ.
          </p>
        ) : (
          clarifications.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                    Question
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500 italic">
                    (Anonymous Vendor)
                  </span>
                </div>
                {item.is_published && (
                  <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    Broadcast to all
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-800 font-medium pl-2 border-l-2 border-blue-400">
                {item.question}
              </p>

              {item.answer ? (
                <div className="mt-3 bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Official Committee Response</span>
                    {item.answered_at && <span>{new Date(item.answered_at).toLocaleString()}</span>}
                  </div>
                  <p className="text-sm text-gray-700">{item.answer}</p>
                </div>
              ) : isBuyer && onAnswerQuestion ? (
                answeringId === item.id ? (
                  <div className="mt-3 space-y-2.5 bg-gray-50 p-3 rounded border">
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Write committee answer..."
                      className="w-full text-sm border border-gray-300 rounded p-2"
                      rows={2}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={broadcast}
                          onChange={(e) => setBroadcast(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        Broadcast answer to all invited suppliers
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAnsweringId(null)}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting || !answerText.trim()}
                          onClick={() => handleAnswer(item.id)}
                          className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                          Publish Answer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAnsweringId(item.id);
                      setAnswerText("");
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline pt-1"
                  >
                    + Answer this Question
                  </button>
                )
              ) : (
                <p className="text-xs text-amber-600 italic">Pending committee response</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
