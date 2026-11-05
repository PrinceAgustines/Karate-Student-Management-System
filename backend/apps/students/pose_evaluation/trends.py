from datetime import timedelta
from typing import Any, Dict, List

import numpy as np
from django.utils import timezone

from apps.students.models import StanceEvaluation, Student


class PoseAnalyticsService:
    @staticmethod
    def calculate_accuracy_trend(student: Student, days: int = 30) -> Dict[str, Any]:
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        evaluations = StanceEvaluation.objects.filter(
            student=student,
            date_evaluated__gte=start_date,
            date_evaluated__lte=end_date,
        ).order_by('date_evaluated')

        daily_scores: Dict[str, List[int]] = {}
        for evaluation in evaluations:
            date = evaluation.date_evaluated.isoformat()
            daily_scores.setdefault(date, []).append(evaluation.score)

        trend_data = [
            {
                'date': date,
                'accuracy': int(np.mean(scores)),
                'consistency': int(np.std(scores)) if len(scores) > 1 else 0,
            }
            for date, scores in sorted(daily_scores.items())
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
            'evaluations_count': sum(len(scores) for scores in daily_scores.values()),
        }
