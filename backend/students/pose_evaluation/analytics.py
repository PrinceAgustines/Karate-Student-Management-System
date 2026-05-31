"""
Predictive Analytics Service for Pose Evaluation
Analyzes performance trends and generates actionable insights
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from django.db.models import QuerySet, Avg, Min, Max, F
from django.utils import timezone

from students.models import StanceEvaluation, Student


logger = logging.getLogger(__name__)


class PoseAnalyticsService:
    """Service for analyzing pose evaluation trends and generating predictive insights."""

    @staticmethod
    def calculate_accuracy_trend(
        student: Student,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Calculate accuracy trends for a student over a specified period.
        
        Args:
            student: Student instance
            days: Number of days to analyze
            
        Returns:
            Dictionary with trend data and statistics
        """
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        evaluations = StanceEvaluation.objects.filter(
            student=student,
            date_evaluated__gte=start_date,
            date_evaluated__lte=end_date
        ).order_by('date_evaluated')
        
        if not evaluations.exists():
            return {
                'trend_data': [],
                'current_accuracy': 0,
                'average_accuracy': 0,
                'max_accuracy': 0,
                'min_accuracy': 0,
                'trend_direction': 'stable',
                'improvement_rate': 0,
                'evaluations_count': 0,
            }
        
        # Group by date and aggregate
        daily_data = {}
        for evaluation in evaluations:
            date_key = evaluation.date_evaluated.isoformat()
            if date_key not in daily_data:
                daily_data[date_key] = []
            daily_data[date_key].append(evaluation.score)
        
        trend_data = [
            {
                'date': date,
                'accuracy': int(np.mean(scores)),
                'consistency': int(np.std(scores)) if len(scores) > 1 else 0,
            }
            for date, scores in sorted(daily_data.items())
        ]
        
        accuracies = [data['accuracy'] for data in trend_data]
        
        # Calculate statistics
        current_accuracy = accuracies[-1] if accuracies else 0
        average_accuracy = int(np.mean(accuracies)) if accuracies else 0
        max_accuracy = int(np.max(accuracies)) if accuracies else 0
        min_accuracy = int(np.min(accuracies)) if accuracies else 0
        
        # Calculate trend direction (first half vs second half)
        mid_point = len(accuracies) // 2
        if mid_point > 0:
            first_half_avg = np.mean(accuracies[:mid_point])
            second_half_avg = np.mean(accuracies[mid_point:])
            improvement_rate = int(second_half_avg - first_half_avg)
            trend_direction = (
                'improving' if improvement_rate > 5 else
                'declining' if improvement_rate < -5 else
                'stable'
            )
        else:
            improvement_rate = 0
            trend_direction = 'stable'
        
        return {
            'trend_data': trend_data,
            'current_accuracy': current_accuracy,
            'average_accuracy': average_accuracy,
            'max_accuracy': max_accuracy,
            'min_accuracy': min_accuracy,
            'trend_direction': trend_direction,
            'improvement_rate': improvement_rate,
            'evaluations_count': len(evaluations),
        }

    @staticmethod
    def project_accuracy(
        student: Student,
        days: int = 30,
        projection_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Project future accuracy based on historical trend.
        
        Args:
            student: Student instance
            days: Historical days to use for projection
            projection_days: Days to project into the future
            
        Returns:
            Dictionary with projection data
        """
        trend_info = PoseAnalyticsService.calculate_accuracy_trend(student, days)
        
        if not trend_info['trend_data']:
            return {
                'projected_accuracy': 0,
                'confidence': 0,
                'projection_basis': 'insufficient_data'
            }
        
        accuracies = [data['accuracy'] for data in trend_info['trend_data']]
        
        # Need at least 2 points for linear regression
        if len(accuracies) < 2:
            return {
                'projected_accuracy': accuracies[0] if accuracies else 0,
                'confidence': 50,
                'projection_basis': 'insufficient_data_for_projection',
                'current_trajectory': 0,
            }
        
        # Linear regression projection
        x = np.arange(len(accuracies))
        y = np.array(accuracies)
        
        # Fit polynomial of degree 1 (linear)
        z = np.polyfit(x, y, 1)
        p = np.poly1d(z)
        
        # Project
        future_x = len(accuracies) + projection_days
        projected = p(future_x)
        projected_accuracy = int(np.clip(projected, 0, 100))
        
        # Confidence is based on consistency of data
        consistency = 100 - int(np.std(accuracies))  # Lower std = higher confidence
        consistency = int(np.clip(consistency, 10, 95))  # Ensure it's a Python int
        
        return {
            'projected_accuracy': projected_accuracy,
            'confidence': int(consistency),  # Ensure it's a Python int
            'projection_basis': 'linear_regression',
            'current_trajectory': int(trend_info['improvement_rate']),  # Ensure it's a Python int
        }

    @staticmethod
    def generate_insights(
        student: Student,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Generate actionable insights based on student's performance.
        
        Args:
            student: Student instance
            days: Number of days to analyze
            
        Returns:
            List of insight dictionaries
        """
        trend_info = PoseAnalyticsService.calculate_accuracy_trend(student, days)
        projection = PoseAnalyticsService.project_accuracy(student, days)
        
        insights = []
        
        current = trend_info['current_accuracy']
        average = trend_info['average_accuracy']
        improvement = trend_info['improvement_rate']
        trend = trend_info['trend_direction']
        
        # Insight 1: Performance level
        if current >= 85:
            insights.append({
                'title': 'Excellent Form',
                'description': f'Your current accuracy of {current}% demonstrates strong technique execution.',
                'recommendation': 'Maintain your form consistency and explore advanced techniques.',
                'priority': 'low',
                'icon': 'star',
                'category': 'performance_level',
            })
        elif current >= 75:
            insights.append({
                'title': 'Good Progress',
                'description': f'You are performing at {current}%, which is a solid level.',
                'recommendation': 'Focus on technical refinements and consistency in execution.',
                'priority': 'medium',
                'icon': 'trending_up',
                'category': 'performance_level',
            })
        elif current >= 65:
            insights.append({
                'title': 'Improving Skills',
                'description': f'Your accuracy is {current}%. Keep practicing to reach mastery.',
                'recommendation': 'Practice fundamental movements slowly to build muscle memory.',
                'priority': 'medium',
                'icon': 'trending_up',
                'category': 'performance_level',
            })
        else:
            insights.append({
                'title': 'Skill Development Phase',
                'description': f'Your current accuracy is {current}%. Continue dedicated practice.',
                'recommendation': 'Break down techniques into smaller components and practice each one.',
                'priority': 'high',
                'icon': 'alert',
                'category': 'performance_level',
            })
        
        # Insight 2: Trend analysis
        if trend == 'improving':
            if improvement > 10:
                insights.append({
                    'title': 'Strong Improvement',
                    'description': f'Your accuracy has improved by {improvement}% recently.',
                    'recommendation': 'Keep up the excellent work! Maintain your practice schedule.',
                    'priority': 'low',
                    'icon': 'arrow_up',
                    'category': 'trend',
                })
            else:
                insights.append({
                    'title': 'Steady Improvement',
                    'description': f'You are gradually improving with a {improvement}% gain.',
                    'recommendation': 'Consistency is key. Continue your regular training.',
                    'priority': 'medium',
                    'icon': 'arrow_up',
                    'category': 'trend',
                })
        elif trend == 'declining':
            insights.append({
                'title': 'Attention Needed',
                'description': f'Your accuracy has decreased by {abs(improvement)}% recently.',
                'recommendation': 'Review recent evaluations and focus on correct form fundamentals.',
                'priority': 'high',
                'icon': 'alert',
                'category': 'trend',
            })
        else:
            insights.append({
                'title': 'Stable Performance',
                'description': 'Your accuracy remains consistent over time.',
                'recommendation': 'Push yourself to improve by adding complexity to your practice.',
                'priority': 'medium',
                'icon': 'minus',
                'category': 'trend',
            })
        
        # Insight 3: Variance analysis
        if trend_info['evaluations_count'] >= 5:
            variance = trend_info['max_accuracy'] - trend_info['min_accuracy']
            if variance > 15:
                insights.append({
                    'title': 'Consistency Issue',
                    'description': f'Your accuracy varies significantly ({variance}% range).',
                    'recommendation': 'Practice for consistency. Work on repeating the same form each time.',
                    'priority': 'high',
                    'icon': 'alert',
                    'category': 'consistency',
                })
            elif variance <= 5:
                insights.append({
                    'title': 'Excellent Consistency',
                    'description': 'Your technique execution is very consistent across evaluations.',
                    'recommendation': 'Excellent form stability! Now work on accuracy improvement.',
                    'priority': 'low',
                    'icon': 'check',
                    'category': 'consistency',
                })
        
        # Insight 4: Projection-based
        projected = projection['projected_accuracy']
        if projected < current - 5:
            insights.append({
                'title': 'Watch Your Form',
                'description': 'Your trajectory suggests potential decline if current issues persist.',
                'recommendation': 'Review fundamentals and reset your practice approach.',
                'priority': 'high',
                'icon': 'alert',
                'category': 'projection',
            })
        elif projected >= current + 10:
            insights.append({
                'title': 'Positive Momentum',
                'description': f'Projected to reach {projected}% accuracy based on current trend.',
                'recommendation': 'Maintain your current training plan - you\'re on track for improvement.',
                'priority': 'low',
                'icon': 'target',
                'category': 'projection',
            })
        
        return insights

    @staticmethod
    def get_student_analytics_summary(student: Student) -> Dict[str, Any]:
        """
        Get comprehensive analytics summary for a student.
        
        Args:
            student: Student instance
            
        Returns:
            Dictionary with complete analytics
        """
        trend_info = PoseAnalyticsService.calculate_accuracy_trend(student, 30)
        projection = PoseAnalyticsService.project_accuracy(student, 30, 30)
        insights = PoseAnalyticsService.generate_insights(student, 30)
        
        return {
            'trend': trend_info,
            'projection': projection,
            'insights': insights,
            'summary': {
                'total_evaluations': trend_info['evaluations_count'],
                'current_accuracy': trend_info['current_accuracy'],
                'average_accuracy': trend_info['average_accuracy'],
                'trend_direction': trend_info['trend_direction'],
                'improvement_rate': trend_info['improvement_rate'],
                'max_accuracy': trend_info['max_accuracy'],
                'min_accuracy': trend_info['min_accuracy'],
                'projected_30day': projection['projected_accuracy'],
            },
        }
