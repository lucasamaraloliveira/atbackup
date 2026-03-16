
import React, { useState, useEffect } from 'react';
import { DataService } from '../services/storageService';
import { FileSystemNode } from '../types';
import { Folder, File, ChevronRight, ChevronDown, Check } from 'lucide-react';

interface FileBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
  initialPath: string;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ onSelect, onCancel, initialPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || 'C:');
  const [nodes, setNodes] = useState<FileSystemNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(['C:']);

  useEffect(() => {
    loadPath(currentPath);
  }, [currentPath]);

  const loadPath = async (path: string) => {
    setLoading(true);
    const result = await DataService.mockBrowse(path);
    setNodes(result);
    setLoading(false);
  };

  const handleNavigate = (path: string) => {
      setCurrentPath(path);
      setHistory(prev => [...prev, path]);
  };

  const handleBack = () => {
      if (history.length > 1) {
          const newHist = [...history];
          newHist.pop();
          const prev = newHist[newHist.length - 1];
          setHistory(newHist);
          setCurrentPath(prev);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70]">
       <div className="bg-slate-800 w-full max-w-2xl rounded-xl border border-slate-600 shadow-2xl flex flex-col h-[600px]">
           <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
               <h3 className="font-bold text-lg">Select Source</h3>
               <button onClick={onCancel} className="text-slate-400 hover:text-white">&times;</button>
           </div>
           
           <div className="p-2 bg-slate-900 border-b border-slate-700 flex items-center space-x-2">
                <button onClick={handleBack} disabled={history.length <= 1} className="px-2 text-slate-400 disabled:opacity-30">
                    &uarr;
                </button>
                <input 
                    type="text" 
                    value={currentPath} 
                    readOnly 
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-mono text-slate-300" 
                />
           </div>

           <div className="flex-1 overflow-y-auto p-2">
               {loading ? (
                   <div className="flex justify-center items-center h-full text-slate-500">Loading...</div>
               ) : (
                   <div className="space-y-1">
                       {nodes.length === 0 && <div className="text-slate-500 p-4 text-center">Empty Directory</div>}
                       {nodes.map((node, i) => (
                           <div 
                             key={i}
                             onClick={() => node.type === 'dir' ? handleNavigate(node.path) : null}
                             className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${node.type === 'dir' ? 'hover:bg-slate-700' : 'opacity-75 hover:bg-slate-700/50'}`}
                           >
                               {node.type === 'dir' ? <Folder size={18} className="text-yellow-500" /> : <File size={18} className="text-blue-400" />}
                               <span className="flex-1">{node.name}</span>
                               {node.type === 'dir' ? <ChevronRight size={14} className="text-slate-600"/> : null}
                               <button 
                                 onClick={(e) => { e.stopPropagation(); onSelect(node.path); }}
                                 className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500 text-white"
                               >
                                 Select
                               </button>
                           </div>
                       ))}
                   </div>
               )}
           </div>

           <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex justify-end">
               <button onClick={onCancel} className="text-slate-400 hover:text-white mr-4">Cancel</button>
               <button onClick={() => onSelect(currentPath)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white font-medium">
                   Select Current Folder
               </button>
           </div>
       </div>
    </div>
  );
};

export default FileBrowser;
