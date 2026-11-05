from typing import Any, Dict, List

import numpy as np

from apps.students.models import StanceEvaluation, Student


class PoseAnalyticsService:
    @staticmethod
    def calculate_accuracy_trend(student: Student, session_limit: int = 5) -> Dict[str, Any]:
        evaluations = StanceEvaluation.objects.filter(
            student=student,
        ).order_by('date_evaluated', 'id')

        session_scores: Dict[tuple, Dict[str, Any]] = {}
        for evaluation in evaluations:
            date = evaluation.date_evaluated.isoformat()
            details = evaluation.analysis_details if isinstance(evaluation.analysis_details, dict) else {}
            session_id = details.get('session_id')
            session_key = ('session', str(session_id)) if session_id is not None else ('date', date)
            session = session_scores.setdefault(session_key, {
                'date': date,
                'session_id': session_id,
                'scores': [],
                'sort_id': evaluation.id,
            })
            session['scores'].append(evaluation.score)
            session['sort_id'] = evaluation.id

        sessions = sorted(
            session_scores.values(),
            key=lambda session: (session['date'], session['sort_id']),
        )[-session_limit:]
        trend_data = [
            {
                'date': session['date'],
                'session_id': session['session_id'],
                'accuracy': int(np.mean(session['scores'])),
                'consistency': int(np.std(session['scores'])) if len(session['scores']) > 1 else 0,
            }
            for session in sessions
        ]
        accuracies = [point['accuracy'] for point in trend_data]
        midpoint = len(accuracies) // 2
        improvement_rate = (
            int(np.mean(accuracies[midpoint:]) - np.mean(accuracies[:midpoint]))
            if midpoint
            else 0
        )

        return {
            'trend_data': trend_data,
            'current_accuracy': accuracies[-1] if accuracies else 0,
            'average_accuracy': int(np.mean(accuracies)) if accuracies else 0,
            'max_accuracy': int(np.max(accuracies)) if accuracies else 0,
            'min_accuracy': int(np.min(accuracies)) if accuracies else 0,
            'trend_direction': (
                'improving' if improvement_rate > 5 else
                'declining' if improvement_rate < -5 else
                'stable'
            ),
            'improvement_rate': improvement_rate,
            'evaluations_count': sum(len(session['scores']) for session in sessions),
        }
