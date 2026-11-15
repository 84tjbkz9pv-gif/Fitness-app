import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem {
                    Label("Today", systemImage: "sun.max")
                }
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "calendar")
                }
        }
    }
}

#Preview("Logged") {
    RootView()
        .previewScreen(samples: true)
}
