import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import About from './pages/About';
import Eidos from './pages/Eidos';
import EidosDoc from './pages/EidosDoc';
import { BASE_PATH } from './lib/site';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'blog', element: <Blog /> },
      { path: 'blog/:slug', element: <BlogPost /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:slug', element: <ProjectDetail /> },
      { path: 'eidos', element: <Eidos /> },
      { path: 'eidos/:slug', element: <EidosDoc /> },
      { path: 'about', element: <About /> },
    ],
  },
], { basename: BASE_PATH });

export default function App() {
  return <RouterProvider router={router} />;
}
