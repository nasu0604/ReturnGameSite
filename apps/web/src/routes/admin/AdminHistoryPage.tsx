import type { ClubHistoryRecord } from "@return-game/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { apiDeleteAdmin, apiGetAdmin, apiPatchAdmin, apiPostAdmin } from "../../api/client";
import { formatKoreanDateTime } from "../../utils/date";

interface HistoryResponse {
  history: ClubHistoryRecord[];
}

const emptyForm = {
  id: "",
  eventDate: "",
  title: "",
  summary: ""
};

function toDateInputValue(value: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function AdminHistoryPage() {
  const [history, setHistory] = useState<ClubHistoryRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("연혁을 불러오는 중입니다.");

  async function loadHistory() {
    const payload = await apiGetAdmin<HistoryResponse>("/admin/history");
    setHistory(payload.history);
  }

  useEffect(() => {
    loadHistory()
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "연혁을 불러오지 못했습니다."));
  }, []);

  function editHistory(item: ClubHistoryRecord) {
    setForm({
      id: item.id,
      eventDate: toDateInputValue(item.eventDate),
      title: item.title,
      summary: item.summary
    });
    window.scrollTo({ top: 0, left: 0 });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(form.id ? "연혁을 수정하는 중입니다." : "연혁을 추가하는 중입니다.");

    try {
      const payload = {
        eventDate: form.eventDate,
        title: form.title,
        summary: form.summary
      };

      if (form.id) {
        await apiPatchAdmin(`/admin/history/${form.id}`, payload);
        setStatus("연혁을 수정했습니다.");
      } else {
        await apiPostAdmin("/admin/history", payload);
        setStatus("연혁을 추가했습니다.");
      }
      setForm(emptyForm);
      await loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "연혁 저장에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 연혁을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;

    setStatus("연혁을 삭제하는 중입니다.");
    try {
      await apiDeleteAdmin(`/admin/history/${id}`);
      setStatus("연혁을 삭제했습니다.");
      await loadHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "연혁 삭제에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel wide">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Club history</p>
          <h1>연혁 관리</h1>
        </div>
      </div>

      {status && <p className="status-text">{status}</p>}

      <form className="admin-edit-form" onSubmit={handleSubmit}>
        <label className="admin-form-wide">
          날짜
          <input
            value={form.eventDate}
            onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
            type="date"
            required
          />
        </label>
        <label className="admin-form-wide">
          제목
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
        </label>
        <label className="admin-form-wide">
          한줄 설명
          <input
            value={form.summary}
            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            required
          />
        </label>
        <div className="admin-form-actions">
          <button className="primary-action" type="submit">
            {form.id ? "수정 저장" : "연혁 추가"}
          </button>
        </div>
      </form>

      <div className="admin-table-wrap history-admin-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>제목</th>
              <th>한줄 설명</th>
              <th>최근 수정</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{item.dateLabel}</td>
                <td>{item.title}</td>
                <td>{item.summary}</td>
                <td>{formatKoreanDateTime(item.updatedAt)}</td>
                <td>
                  <div className="table-action-row">
                    <button className="table-button" type="button" onClick={() => editHistory(item)}>
                      수정
                    </button>
                    <button
                      className="table-danger-button"
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
