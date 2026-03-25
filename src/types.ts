export interface IEEEAnalysisReport {
  overall: {
    similarity: number;
    aiUsagePercentage: number;
    humanizedPercentage: number;
    status: 'Safe' | 'Warning' | 'High Risk';
    severityLevel: number;
    severityTitle: string;
    severityExplanation: string;
    recommendedAction: string;
  };
  sections: {
    name: string;
    similarity: number;
    content: string;
  }[];
  sources: {
    name: string;
    similarity: number;
    url?: string;
  }[];
  flaggedContent: {
    text: string;
    type: 'Direct Copying' | 'Poor Paraphrasing' | 'Missing Citation' | 'Repeated Content' | 'Common Technical Phrase';
    explanation: string;
    severity: 'Low' | 'Medium' | 'High';
  }[];
  issues: string[];
  insights: {
    mostPlagiarizedSection: string;
    acceptanceRisk: string;
    selfPlagiarismNote?: string;
  };
  recommendations: string[];
}

export interface PaperSection {
  title: string;
  content: string;
}
