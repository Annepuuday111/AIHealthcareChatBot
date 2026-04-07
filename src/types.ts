export interface InsightData {
  title: string;
  type: 'bar' | 'line' | 'pie';
  data: Array<{ name: string; value: number; uv?: number }>;
}

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  isDataInsight?: boolean;
  insightData?: InsightData;
}
